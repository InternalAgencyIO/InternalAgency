using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CodexGuardian
{
    internal sealed class MainWindowLease : IDisposable
    {
        private Mutex mutex;

        private MainWindowLease(Mutex ownedMutex)
        {
            mutex = ownedMutex;
        }

        public static bool TryAcquire(out MainWindowLease lease)
        {
            lease = null;
            bool created;
            Mutex candidate = new Mutex(true, "Local\\CodexGuardianMainWindow", out created);
            if (!created)
            {
                candidate.Dispose();
                return false;
            }
            lease = new MainWindowLease(candidate);
            return true;
        }

        public void Dispose()
        {
            if (mutex == null) return;
            try { mutex.ReleaseMutex(); } catch { }
            mutex.Dispose();
            mutex = null;
        }
    }

    internal static class Paths
    {
        public static readonly string UserRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CodexGuardian");

        public static readonly string Config = Path.Combine(UserRoot, "guardian.ini");
        public static readonly string Apps = Path.Combine(UserRoot, "allowed-apps.tsv");
        public static readonly string Log = Path.Combine(UserRoot, "guardian.log");
        public static readonly string ChromeProfile = Path.Combine(UserRoot, "ChromeProfile");
        public static readonly string CleanupBackup = Path.Combine(UserRoot, "focus-cleanup-backup.tsv");

        public static void Ensure()
        {
            Directory.CreateDirectory(UserRoot);
            Directory.CreateDirectory(ChromeProfile);
        }
    }

    internal static class AppLog
    {
        private static readonly object Gate = new object();

        public static void Write(string message)
        {
            try
            {
                Paths.Ensure();
                lock (Gate)
                {
                    try
                    {
                        FileInfo current = new FileInfo(Paths.Log);
                        if (current.Exists && current.Length > 2 * 1024 * 1024)
                        {
                            string previous = Paths.Log + ".1";
                            if (File.Exists(previous)) File.Delete(previous);
                            File.Move(Paths.Log, previous);
                        }
                    }
                    catch { }
                    File.AppendAllText(
                        Paths.Log,
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + message + Environment.NewLine,
                        Encoding.UTF8);
                }
            }
            catch
            {
                // Logging must never interfere with the emergency controls.
            }
        }
    }

    internal static class AtomicTextFile
    {
        public static string Read(string path, string mutexName)
        {
            using (Mutex mutex = new Mutex(false, mutexName))
            {
                bool held = false;
                try
                {
                    held = Wait(mutex);
                    if (!held) throw new TimeoutException("Timed out waiting for " + mutexName + ".");
                    return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : "";
                }
                finally
                {
                    if (held) mutex.ReleaseMutex();
                }
            }
        }

        public static void Write(string path, string contents, string mutexName)
        {
            Paths.Ensure();
            using (Mutex mutex = new Mutex(false, mutexName))
            {
                bool held = false;
                string temp = path + "." + Process.GetCurrentProcess().Id + ".tmp";
                try
                {
                    held = Wait(mutex);
                    if (!held) throw new TimeoutException("Timed out waiting for " + mutexName + ".");
                    WriteUnlocked(path, contents, temp);
                }
                finally
                {
                    try { if (File.Exists(temp)) File.Delete(temp); } catch { }
                    if (held) mutex.ReleaseMutex();
                }
            }
        }

        public static void Update(string path, string mutexName, Func<string, string> update)
        {
            Paths.Ensure();
            using (Mutex mutex = new Mutex(false, mutexName))
            {
                bool held = false;
                string temp = path + "." + Process.GetCurrentProcess().Id + ".tmp";
                try
                {
                    held = Wait(mutex);
                    if (!held) throw new TimeoutException("Timed out waiting for " + mutexName + ".");
                    string current = File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : "";
                    WriteUnlocked(path, update(current), temp);
                }
                finally
                {
                    try { if (File.Exists(temp)) File.Delete(temp); } catch { }
                    if (held) mutex.ReleaseMutex();
                }
            }
        }

        private static void WriteUnlocked(string path, string contents, string temp)
        {
            File.WriteAllText(temp, contents, new UTF8Encoding(false));
            if (File.Exists(path))
            {
                try
                {
                    File.Replace(temp, path, null);
                }
                catch
                {
                    File.Copy(temp, path, true);
                    File.Delete(temp);
                }
            }
            else
            {
                File.Move(temp, path);
            }
        }

        private static bool Wait(Mutex mutex)
        {
            try { return mutex.WaitOne(5000); }
            catch (AbandonedMutexException) { return true; }
        }
    }

    internal sealed class GuardianConfig
    {
        public bool Active;
        public bool Strict;
        public bool AllowFirefox;
        public bool AllowManagedChrome;
        public bool KeepWarpConnected;
        public bool LegacyAirPodsStereo;
        public DateTime PausedUntilUtc;

        public GuardianConfig()
        {
            Active = false;
            Strict = true;
            AllowFirefox = false;
            AllowManagedChrome = false;
            KeepWarpConnected = false;
            LegacyAirPodsStereo = false;
            PausedUntilUtc = DateTime.MinValue;
        }

        public bool IsEnforcing
        {
            get { return Active && DateTime.UtcNow >= PausedUntilUtc; }
        }

        public static GuardianConfig Load()
        {
            try
            {
                return Parse(AtomicTextFile.Read(Paths.Config, "Local\\CodexGuardianConfig"));
            }
            catch (Exception ex)
            {
                AppLog.Write("Config read failed: " + ex.Message);
                return new GuardianConfig();
            }
        }

        public void Save()
        {
            AtomicTextFile.Write(Paths.Config, Serialize(), "Local\\CodexGuardianConfig");
        }

        public static GuardianConfig Update(Action<GuardianConfig> change)
        {
            GuardianConfig updated = null;
            AtomicTextFile.Update(Paths.Config, "Local\\CodexGuardianConfig", delegate(string text)
            {
                updated = Parse(text);
                change(updated);
                return updated.Serialize();
            });
            return updated;
        }

        public string Serialize()
        {
            StringBuilder text = new StringBuilder();
            text.AppendLine("Version=1");
            text.AppendLine("Active=" + Bool(Active));
            text.AppendLine("Strict=" + Bool(Strict));
            text.AppendLine("AllowFirefox=" + Bool(AllowFirefox));
            text.AppendLine("AllowManagedChrome=" + Bool(AllowManagedChrome));
            text.AppendLine("KeepWarpConnected=" + Bool(KeepWarpConnected));
            text.AppendLine("AirPodsStereo=" + Bool(LegacyAirPodsStereo));
            text.AppendLine("PausedUntilUtcTicks=" + PausedUntilUtc.Ticks);
            return text.ToString();
        }

        public static GuardianConfig Parse(string text)
        {
            GuardianConfig config = new GuardianConfig();
            foreach (string raw in (text ?? "").Split(new[] { "\r\n", "\n" }, StringSplitOptions.None))
            {
                string line = raw.Trim();
                int equals = line.IndexOf('=');
                if (equals < 1) continue;
                string key = line.Substring(0, equals).Trim();
                string value = line.Substring(equals + 1).Trim();
                if (key.Equals("Active", StringComparison.OrdinalIgnoreCase)) config.Active = IsTrue(value);
                else if (key.Equals("Strict", StringComparison.OrdinalIgnoreCase)) config.Strict = IsTrue(value);
                else if (key.Equals("AllowFirefox", StringComparison.OrdinalIgnoreCase)) config.AllowFirefox = IsTrue(value);
                else if (key.Equals("AllowManagedChrome", StringComparison.OrdinalIgnoreCase)) config.AllowManagedChrome = IsTrue(value);
                else if (key.Equals("KeepWarpConnected", StringComparison.OrdinalIgnoreCase)) config.KeepWarpConnected = IsTrue(value);
                else if (key.Equals("AirPodsStereo", StringComparison.OrdinalIgnoreCase)) config.LegacyAirPodsStereo = IsTrue(value);
                else if (key.Equals("PausedUntilUtcTicks", StringComparison.OrdinalIgnoreCase))
                {
                    long ticks;
                    if (Int64.TryParse(value, out ticks) && ticks >= DateTime.MinValue.Ticks && ticks <= DateTime.MaxValue.Ticks)
                        config.PausedUntilUtc = new DateTime(ticks, DateTimeKind.Utc);
                }
                // Backward compatibility with the first private build.
                else if (key.Equals("PausedUntilUtc", StringComparison.OrdinalIgnoreCase))
                {
                    long ticks;
                    if (Int64.TryParse(value, out ticks) && ticks >= DateTime.MinValue.Ticks && ticks <= DateTime.MaxValue.Ticks)
                        config.PausedUntilUtc = new DateTime(ticks, DateTimeKind.Utc);
                }
            }
            return config;
        }

        private static string Bool(bool value) { return value ? "1" : "0"; }
        private static bool IsTrue(string value) { return value == "1" || value.Equals("true", StringComparison.OrdinalIgnoreCase); }
    }

    internal sealed class AppEntry
    {
        public string Id;
        public string DisplayName;
        public string ExecutablePath;
        public string ProcessName;
        public bool Enabled;
        public bool BuiltIn;

        public string Serialize()
        {
            return String.Join("\t", new[]
            {
                Encode(Id), Encode(DisplayName), Encode(ExecutablePath), Encode(ProcessName), Enabled ? "1" : "0"
            });
        }

        public static AppEntry Parse(string line)
        {
            string[] parts = (line ?? "").Split('\t');
            if (parts.Length != 5) return null;
            try
            {
                string path = Decode(parts[2]);
                return new AppEntry
                {
                    Id = Decode(parts[0]),
                    DisplayName = Decode(parts[1]),
                    ExecutablePath = AppDiscovery.NormalizePath(path),
                    ProcessName = Decode(parts[3]),
                    Enabled = parts[4] == "1",
                    BuiltIn = false
                };
            }
            catch
            {
                return null;
            }
        }

        private static string Encode(string value)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(value ?? ""));
        }

        private static string Decode(string value)
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(value));
        }
    }

    internal static class AppCatalog
    {
        public const string FirefoxId = "builtin-firefox";
        public const string ManagedChromeId = "builtin-managed-chrome";

        public static List<AppEntry> Load(GuardianConfig config)
        {
            List<AppEntry> result;
            TryLoad(config, out result);
            return result;
        }

        public static bool TryLoad(GuardianConfig config, out List<AppEntry> result)
        {
            result = new List<AppEntry>();
            result.Add(new AppEntry
            {
                Id = FirefoxId,
                DisplayName = "Mozilla Firefox",
                ExecutablePath = AppDiscovery.FindFirefox(),
                ProcessName = "firefox",
                Enabled = config.AllowFirefox,
                BuiltIn = true
            });
            result.Add(new AppEntry
            {
                Id = ManagedChromeId,
                DisplayName = "Google Chrome (isolated)",
                ExecutablePath = AppDiscovery.FindChrome(),
                ProcessName = "chrome",
                Enabled = config.AllowManagedChrome,
                BuiltIn = true
            });

            try
            {
                string text = AtomicTextFile.Read(Paths.Apps, "Local\\CodexGuardianApps");
                foreach (string raw in text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries))
                {
                    if (raw.StartsWith("#")) continue;
                    AppEntry entry = AppEntry.Parse(raw);
                    if (entry == null || entry.Id.Length == 0 || entry.ExecutablePath.Length == 0)
                    {
                        AppLog.Write("Allowed-app list contains an invalid entry; enforcement skipped.");
                        return false;
                    }
                    result.Add(entry);
                }
            }
            catch (Exception ex)
            {
                AppLog.Write("Allowed-app list read failed: " + ex.Message);
                return false;
            }
            return true;
        }

        public static void Save(List<AppEntry> entries)
        {
            AppEntry firefox = entries.FirstOrDefault(delegate(AppEntry x) { return x.Id == FirefoxId; });
            AppEntry chrome = entries.FirstOrDefault(delegate(AppEntry x) { return x.Id == ManagedChromeId; });
            GuardianConfig.Update(delegate(GuardianConfig config)
            {
                if (firefox != null) config.AllowFirefox = firefox.Enabled;
                if (chrome != null) config.AllowManagedChrome = chrome.Enabled;
            });

            StringBuilder text = new StringBuilder();
            text.AppendLine("# Codex Guardian custom allowed apps v1");
            foreach (AppEntry entry in entries.Where(delegate(AppEntry x) { return !x.BuiltIn; }))
                text.AppendLine(entry.Serialize());
            AtomicTextFile.Write(Paths.Apps, text.ToString(), "Local\\CodexGuardianApps");
        }

        public static bool IsExplicitlyAllowed(string processName, string executablePath, List<AppEntry> entries)
        {
            string normalized = AppDiscovery.NormalizePath(executablePath);
            foreach (AppEntry entry in entries)
            {
                if (!entry.Enabled) continue;
                if (entry.Id == ManagedChromeId) continue;
                if (normalized.Length > 0 && entry.ExecutablePath.Length > 0 &&
                    normalized.Equals(entry.ExecutablePath, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }
    }

    internal static class AppDiscovery
    {
        public static string FindFirefox()
        {
            return FindExecutable("firefox.exe", new[]
            {
                Combine(Environment.SpecialFolder.ProgramFiles, @"Mozilla Firefox\firefox.exe"),
                Combine(Environment.SpecialFolder.ProgramFilesX86, @"Mozilla Firefox\firefox.exe")
            });
        }

        public static string FindChrome()
        {
            return FindExecutable("chrome.exe", new[]
            {
                Combine(Environment.SpecialFolder.ProgramFiles, @"Google\Chrome\Application\chrome.exe"),
                Combine(Environment.SpecialFolder.ProgramFilesX86, @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            });
        }

        public static string FindWarpCli()
        {
            string[] candidates =
            {
                Combine(Environment.SpecialFolder.ProgramFiles, @"Cloudflare\Cloudflare WARP\warp-cli.exe"),
                Combine(Environment.SpecialFolder.ProgramFilesX86, @"Cloudflare\Cloudflare WARP\warp-cli.exe")
            };
            return candidates.FirstOrDefault(File.Exists) ?? "";
        }

        public static string NormalizePath(string path)
        {
            if (String.IsNullOrWhiteSpace(path)) return "";
            try { return Path.GetFullPath(Environment.ExpandEnvironmentVariables(path.Trim().Trim('"'))); }
            catch { return path.Trim().Trim('"'); }
        }

        private static string FindExecutable(string executable, string[] candidates)
        {
            string appPath = FindAppPath(Registry.CurrentUser, executable);
            if (appPath.Length == 0) appPath = FindAppPath(Registry.LocalMachine, executable);
            if (File.Exists(appPath)) return NormalizePath(appPath);
            foreach (string candidate in candidates)
                if (File.Exists(candidate)) return NormalizePath(candidate);
            return "";
        }

        private static string FindAppPath(RegistryKey hive, string executable)
        {
            try
            {
                using (RegistryKey key = hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + executable))
                    return key == null ? "" : Convert.ToString(key.GetValue(""));
            }
            catch { return ""; }
        }

        private static string Combine(Environment.SpecialFolder folder, string relative)
        {
            string root = Environment.GetFolderPath(folder);
            return root.Length == 0 ? "" : Path.Combine(root, relative);
        }
    }

    internal static class Shell
    {
        public static bool IsAdministrator()
        {
            WindowsPrincipal principal = new WindowsPrincipal(WindowsIdentity.GetCurrent());
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }

        public static int Run(string file, string arguments, bool wait, bool hidden)
        {
            try
            {
                ProcessStartInfo info = new ProcessStartInfo(file, arguments ?? "");
                info.UseShellExecute = !hidden;
                if (hidden)
                {
                    info.CreateNoWindow = true;
                    info.WindowStyle = ProcessWindowStyle.Hidden;
                }
                Process process = Process.Start(info);
                if (process == null) return -1;
                if (!wait) return 0;
                if (!process.WaitForExit(10000))
                {
                    try { process.Kill(); } catch { }
                    process.Dispose();
                    AppLog.Write("Timed out launching: " + file);
                    return -2;
                }
                int code = process.ExitCode;
                process.Dispose();
                return code;
            }
            catch (Exception ex)
            {
                AppLog.Write("Launch failed: " + file + " (" + ex.Message + ")");
                return -1;
            }
        }

    }
}
