using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CodexGuardian
{
    internal static class GuardianState
    {
        public static void Enable()
        {
            GuardianConfig.Update(delegate(GuardianConfig config)
            {
                config.Active = true;
                config.Strict = true;
                config.PausedUntilUtc = DateTime.MinValue;
            });
            Persistence.StartWatchdog();
            AppLog.Write("Guardian enabled.");
        }

        public static bool ConfirmAndEnable(IWin32Window owner)
        {
            const string warning = "Save work in apps that are not checked in Guardian. Guardian will first ask them to close, then force-close any that remain after 3.5 seconds.\n\nEnable now?";
            DialogResult answer = owner == null
                ? MessageBox.Show(warning, "Enable Guardian", MessageBoxButtons.YesNo, MessageBoxIcon.Warning)
                : MessageBox.Show(owner, warning, "Enable Guardian", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
            if (answer != DialogResult.Yes) return false;
            Enable();
            return true;
        }

        public static void Pause(int minutes)
        {
            GuardianConfig.Update(delegate(GuardianConfig config)
            {
                config.PausedUntilUtc = DateTime.UtcNow.AddMinutes(minutes);
            });
            AppLog.Write("Guardian paused for " + minutes + " minutes.");
        }

        public static void EmergencyStop()
        {
            GuardianConfig.Update(delegate(GuardianConfig config)
            {
                config.Active = false;
                config.PausedUntilUtc = DateTime.MinValue;
            });
            AppLog.Write("Guardian emergency-stopped.");
        }
    }

    internal static class ProcessGuard
    {
        private static readonly HashSet<string> AlwaysAllowedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "CodexGuardian", "Codex", "ChatGPT",
            "explorer", "SearchHost", "SearchApp", "StartMenuExperienceHost", "ShellExperienceHost", "ShellHost", "sihost",
            "TextInputHost", "RuntimeBroker", "ApplicationFrameHost", "SystemSettings", "Taskmgr", "mmc", "control",
            "powershell", "pwsh", "cmd", "conhost", "OpenConsole", "WindowsTerminal", "wt", "notepad",
            "node", "node_repl", "python", "pythonw", "git", "git-credential-manager", "ssh", "rg",
            "wsl", "wslhost", "vmmem", "vmmemWSL", "vmconnect", "virtmgmt",
            "dwm", "LockApp", "SecurityHealthSystray", "smartscreen", "consent", "UserOOBEBroker", "dllhost", "taskhostw",
            "Cloudflare WARP", "warp-svc", "warp-cli"
        };

        private sealed class Candidate
        {
            public int Id;
            public string Name;
            public long StartedUtcTicks;
        }

        public static void Enforce(GuardianConfig config)
        {
            List<AppEntry> apps;
            if (!AppCatalog.TryLoad(config, out apps)) return;

            List<Candidate> candidates = new List<Candidate>();
            int currentProcess = Process.GetCurrentProcess().Id;
            int currentSession = Process.GetCurrentProcess().SessionId;
            foreach (Process process in Process.GetProcesses())
            {
                try
                {
                    if (process.Id == currentProcess || process.SessionId != currentSession) continue;
                    if (ShouldStop(process, config, apps))
                    {
                        Candidate candidate = new Candidate();
                        candidate.Id = process.Id;
                        candidate.Name = process.ProcessName;
                        try { candidate.StartedUtcTicks = process.StartTime.ToUniversalTime().Ticks; } catch { candidate.StartedUtcTicks = 0; }
                        candidates.Add(candidate);
                        process.CloseMainWindow();
                        AppLog.Write("Asked unapproved app to close: " + candidate.Name + " (" + candidate.Id + ")");
                    }
                }
                catch
                {
                    // Processes can exit or become inaccessible while enumerating.
                }
                finally
                {
                    process.Dispose();
                }
            }

            if (candidates.Count == 0) return;
            Thread.Sleep(3500);

            GuardianConfig current = GuardianConfig.Load();
            if (!current.IsEnforcing) return;
            if (!AppCatalog.TryLoad(current, out apps)) return;
            foreach (Candidate candidate in candidates)
            {
                try
                {
                    using (Process process = Process.GetProcessById(candidate.Id))
                    {
                        if (candidate.StartedUtcTicks != 0 && process.StartTime.ToUniversalTime().Ticks != candidate.StartedUtcTicks) continue;
                        if (!ShouldStop(process, current, apps)) continue;
                        process.Kill();
                        AppLog.Write("Force-closed unapproved app after grace period: " + candidate.Name + " (" + candidate.Id + ")");
                    }
                }
                catch
                {
                    // The application closed during the grace period.
                }
            }
        }

        public static bool IsCoreAllowed(string name, string path)
        {
            if (AlwaysAllowedNames.Contains(name)) return true;
            if (path.Equals(AppDiscovery.NormalizePath(Application.ExecutablePath), StringComparison.OrdinalIgnoreCase)) return true;
            try
            {
                FileVersionInfo version = FileVersionInfo.GetVersionInfo(path);
                if (version.ProductName == "Codex Guardian" && version.CompanyName == "Internal Agency") return true;
            }
            catch { }
            if (path.IndexOf("\\OpenAI.Codex_", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            if (path.IndexOf("\\OpenAI\\Codex\\", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            return false;
        }

        private static bool ShouldStop(Process process, GuardianConfig config, List<AppEntry> apps)
        {
            if (!config.Strict || process.MainWindowHandle == IntPtr.Zero) return false;
            string name = process.ProcessName;
            string path = SafePath(process);
            if (path.Length == 0) return false;
            string windowsRoot = Environment.GetFolderPath(Environment.SpecialFolder.Windows).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            bool windowsComponent = path.StartsWith(windowsRoot, StringComparison.OrdinalIgnoreCase);
            if (windowsComponent || IsCoreAllowed(name, path)) return false;
            if (AppCatalog.IsExplicitlyAllowed(name, path, apps)) return false;
            if (name.Equals("chrome", StringComparison.OrdinalIgnoreCase) && config.AllowManagedChrome && IsManagedChrome(process.Id)) return false;
            return true;
        }

        private static bool IsManagedChrome(int processId)
        {
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT CommandLine FROM Win32_Process WHERE ProcessId=" + processId))
                using (ManagementObjectCollection results = searcher.Get())
                {
                    foreach (ManagementObject result in results)
                    {
                        string commandLine = Convert.ToString(result["CommandLine"]);
                        return commandLine.IndexOf(Paths.ChromeProfile, StringComparison.OrdinalIgnoreCase) >= 0;
                    }
                }
            }
            catch { }
            return false;
        }

        private static string SafePath(Process process)
        {
            try { return process.MainModule == null ? "" : AppDiscovery.NormalizePath(process.MainModule.FileName); }
            catch { return ""; }
        }

    }

    internal static class Launchers
    {
        public static bool Launch(AppEntry entry)
        {
            if (entry == null || String.IsNullOrWhiteSpace(entry.ExecutablePath) || !File.Exists(entry.ExecutablePath))
            {
                MessageBox.Show(
                    "The application could not be found. Remove it and add the correct executable.",
                    "Codex Guardian",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return false;
            }

            string arguments = "";
            if (entry.Id == AppCatalog.ManagedChromeId)
            {
                Paths.Ensure();
                arguments = "--user-data-dir=\"" + Paths.ChromeProfile +
                            "\" --no-first-run --disable-background-mode about:blank";
            }

            int code = Shell.Run(entry.ExecutablePath, arguments, false, false);
            if (code == 0) AppLog.Write("Launched allowed app: " + entry.DisplayName);
            return code == 0;
        }

        public static void EnsureWarpConnected()
        {
            string cli = AppDiscovery.FindWarpCli();
            if (cli.Length > 0) Shell.Run(cli, "connect", true, true);
        }
    }

    internal static class Persistence
    {
        private const string RunPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string ValueName = "InternalAgency Codex Guardian";

        public static bool IsEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RunPath))
                    return key != null && Convert.ToString(key.GetValue(ValueName)).Equals(ExpectedCommand(), StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        public static void SetEnabled(bool enabled, bool unused)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(RunPath))
                {
                    if (enabled)
                        key.SetValue(ValueName, ExpectedCommand(), RegistryValueKind.String);
                    else
                        key.DeleteValue(ValueName, false);
                }
                AppLog.Write(enabled ? "Start-at-sign-in enabled for: " + Application.ExecutablePath : "Start-at-sign-in disabled.");
                if (enabled) StartWatchdog();
            }
            catch (Exception ex)
            {
                AppLog.Write("Start-at-sign-in change failed: " + ex.Message);
                MessageBox.Show("Windows did not allow the sign-in setting to be changed.", "Codex Guardian", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        public static bool IsWatchdogRunning()
        {
            try
            {
                using (Mutex.OpenExisting("Local\\CodexGuardianWatchdog")) return true;
            }
            catch (WaitHandleCannotBeOpenedException) { return false; }
            catch { return false; }
        }

        private static string ExpectedCommand()
        {
            return "\"" + Application.ExecutablePath + "\" --watchdog";
        }

        public static void StartWatchdog()
        {
            Shell.Run(Application.ExecutablePath, "--watchdog", false, false);
        }
    }

    internal static class FocusCleanup
    {
        private sealed class Setting
        {
            public RegistryKey Hive;
            public string HiveName;
            public string Path;
            public string Name;
            public int Value;
        }

        private static readonly Setting[] Settings =
        {
            new Setting { Hive = Registry.CurrentUser, HiveName = "HKCU", Path = @"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", Name = "SilentInstalledAppsEnabled", Value = 0 },
            new Setting { Hive = Registry.CurrentUser, HiveName = "HKCU", Path = @"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", Name = "SystemPaneSuggestionsEnabled", Value = 0 },
            new Setting { Hive = Registry.CurrentUser, HiveName = "HKCU", Path = @"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", Name = "SubscribedContent-338388Enabled", Value = 0 },
            new Setting { Hive = Registry.CurrentUser, HiveName = "HKCU", Path = @"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo", Name = "Enabled", Value = 0 },
            new Setting { Hive = Registry.CurrentUser, HiveName = "HKCU", Path = @"System\GameConfigStore", Name = "GameDVR_Enabled", Value = 0 }
        };

        public static bool HasBackup { get { return File.Exists(Paths.CleanupBackup); } }

        public static void Apply()
        {
            Paths.Ensure();
            if (HasBackup)
            {
                MessageBox.Show("The reversible focus cleanup is already applied.", "Codex Guardian", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            StringBuilder backup = new StringBuilder();
            backup.AppendLine("CODEX-GUARDIAN-FOCUS-CLEANUP\t1\t" + DateTime.UtcNow.ToString("o"));
            try
            {
                foreach (Setting setting in Settings)
                {
                    using (RegistryKey key = setting.Hive.OpenSubKey(setting.Path))
                    {
                        object previous = key == null ? null : key.GetValue(setting.Name, null, RegistryValueOptions.DoNotExpandEnvironmentNames);
                        bool existed = previous != null;
                        RegistryValueKind kind = existed && key != null ? key.GetValueKind(setting.Name) : RegistryValueKind.None;
                        backup.AppendLine(String.Join("\t", new[]
                        {
                            setting.HiveName,
                            Encode(setting.Path),
                            Encode(setting.Name),
                            existed ? "1" : "0",
                            kind.ToString(),
                            EncodeValue(previous, kind)
                        }));
                    }
                }
                AtomicTextFile.Write(Paths.CleanupBackup, backup.ToString(), "Local\\CodexGuardianCleanup");
            }
            catch (Exception ex)
            {
                AppLog.Write("Focus cleanup backup failed: " + ex.Message);
                MessageBox.Show("Focus cleanup was not applied because its recovery backup could not be saved.", "Codex Guardian", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            int applied = 0;
            foreach (Setting setting in Settings)
            {
                try
                {
                    using (RegistryKey key = setting.Hive.CreateSubKey(setting.Path))
                        key.SetValue(setting.Name, setting.Value, RegistryValueKind.DWord);
                    applied++;
                }
                catch (Exception ex) { AppLog.Write("Focus cleanup setting failed: " + setting.Name + " (" + ex.Message + ")"); }
            }
            AppLog.Write("Reversible focus cleanup applied to " + applied + " of " + Settings.Length + " settings.");
            MessageBox.Show(
                applied == Settings.Length
                    ? "Focus cleanup applied. It only changes five current-user Windows suggestion, advertising, and Game DVR settings. No services, startup apps, drivers, or files were removed."
                    : "Focus cleanup was only partly applied. The recovery backup is intact; use RESTORE CLEANUP to revert the changed settings.",
                "Codex Guardian",
                MessageBoxButtons.OK,
                applied == Settings.Length ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
        }

        public static void Restore()
        {
            if (!HasBackup)
            {
                MessageBox.Show("No focus-cleanup backup was found.", "Codex Guardian", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            string[] lines;
            try { lines = File.ReadAllLines(Paths.CleanupBackup, Encoding.UTF8); }
            catch (Exception ex)
            {
                AppLog.Write("Focus cleanup backup read failed: " + ex.Message);
                MessageBox.Show("The cleanup backup could not be read, so no settings were changed.", "Codex Guardian", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            if (lines.Length != Settings.Length + 1 || !lines[0].StartsWith("CODEX-GUARDIAN-FOCUS-CLEANUP\t1\t", StringComparison.Ordinal))
            {
                MessageBox.Show("The cleanup backup is invalid. Guardian left it in place and changed nothing.", "Codex Guardian", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            bool restoredAll = true;
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int index = lines.Length - 1; index >= 1; index--)
            {
                string[] parts = lines[index].Split('\t');
                if (parts.Length != 6 || parts[0] != "HKCU" || (parts[3] != "0" && parts[3] != "1"))
                {
                    restoredAll = false;
                    continue;
                }
                try
                {
                    string path = Decode(parts[1]);
                    string name = Decode(parts[2]);
                    string identity = path + "\0" + name;
                    bool allowed = Settings.Any(delegate(Setting setting)
                    {
                        return setting.Path.Equals(path, StringComparison.OrdinalIgnoreCase) && setting.Name.Equals(name, StringComparison.OrdinalIgnoreCase);
                    });
                    if (!allowed || !seen.Add(identity))
                    {
                        restoredAll = false;
                        continue;
                    }
                    using (RegistryKey key = Registry.CurrentUser.CreateSubKey(path))
                    {
                        if (parts[3] == "0") key.DeleteValue(name, false);
                        else
                        {
                            RegistryValueKind kind;
                            if (!Enum.TryParse<RegistryValueKind>(parts[4], out kind)) kind = RegistryValueKind.String;
                            key.SetValue(name, DecodeValue(parts[5], kind), kind);
                        }
                    }
                }
                catch (Exception ex)
                {
                    restoredAll = false;
                    AppLog.Write("Focus cleanup restore failed: " + ex.Message);
                }
            }

            restoredAll = restoredAll && seen.Count == Settings.Length;
            if (restoredAll)
            {
                string restored = Paths.CleanupBackup + ".restored-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
                try { File.Move(Paths.CleanupBackup, restored); }
                catch (Exception ex) { restoredAll = false; AppLog.Write("Cleanup backup archive failed: " + ex.Message); }
            }
            AppLog.Write(restoredAll ? "Reversible focus cleanup restored." : "Focus cleanup restore incomplete; backup retained.");
            MessageBox.Show(
                restoredAll ? "Focus cleanup settings were restored." : "Some cleanup settings could not be restored. The backup remains available so you can retry.",
                "Codex Guardian",
                MessageBoxButtons.OK,
                restoredAll ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
        }

        private static string Encode(string value)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(value ?? ""));
        }

        private static string Decode(string value)
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(value));
        }

        private static string EncodeValue(object value, RegistryValueKind kind)
        {
            if (value == null) return "";
            if (kind == RegistryValueKind.Binary) return Convert.ToBase64String((byte[])value);
            if (kind == RegistryValueKind.MultiString) return Encode(String.Join("\0", (string[])value));
            return Encode(Convert.ToString(value));
        }

        private static object DecodeValue(string value, RegistryValueKind kind)
        {
            if (kind == RegistryValueKind.Binary) return Convert.FromBase64String(value);
            string decoded = Decode(value);
            if (kind == RegistryValueKind.MultiString) return decoded.Split(new[] { "\0" }, StringSplitOptions.None);
            int dword;
            long qword;
            if (kind == RegistryValueKind.DWord && Int32.TryParse(decoded, out dword)) return dword;
            if (kind == RegistryValueKind.QWord && Int64.TryParse(decoded, out qword)) return qword;
            return decoded;
        }
    }

}
