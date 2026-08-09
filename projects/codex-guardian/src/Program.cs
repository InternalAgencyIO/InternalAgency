using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace CodexGuardian
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Paths.Ensure();

            string command = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            try
            {
                if ((command.Length == 0 || command == "--watchdog") && Shell.IsAdministrator())
                {
                    MessageBox.Show(
                        "Codex Guardian intentionally runs with normal user privileges. Close this copy and start it normally instead of using Run as administrator.",
                        "Codex Guardian",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                    return;
                }
                if (command == "--watchdog")
                {
                    RunWatchdog();
                    return;
                }
                if (command == "--enable-startup")
                {
                    Persistence.SetEnabled(true, false);
                    return;
                }
                if (command == "--disable-startup")
                {
                    Persistence.SetEnabled(false, false);
                    return;
                }
                if (command == "--emergency-stop")
                {
                    GuardianState.EmergencyStop();
                    MessageBox.Show("Guardian enforcement is off.", "Codex Guardian", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                if (command == "--self-test")
                {
                    Environment.ExitCode = SelfTest.Run() ? 0 : 1;
                    return;
                }
                if (command == "--capture-ui" && args.Length > 1)
                {
                    CaptureUi(args[1]);
                    return;
                }

                MainWindowLease lease;
                if (!MainWindowLease.TryAcquire(out lease))
                {
                    MessageBox.Show(
                        "Codex Guardian is already open. Use the existing window or the notification-area shield.",
                        "Codex Guardian",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                    return;
                }
                using (lease)
                    Application.Run(new MainForm());
            }
            catch (Exception ex)
            {
                AppLog.Write("Fatal error: " + ex);
                if (command != "--self-test")
                    MessageBox.Show(ex.Message, "Codex Guardian error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Environment.ExitCode = 1;
            }
        }

        private static void RunWatchdog()
        {
            bool created;
            using (Mutex mutex = new Mutex(true, "Local\\CodexGuardianWatchdog", out created))
            {
                if (!created) return;
                Application.Run(new GuardianContext());
            }
        }

        private static void CaptureUi(string outputPath)
        {
            string path = Path.GetFullPath(outputPath);
            string directory = Path.GetDirectoryName(path);
            if (!String.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
            using (MainForm form = new MainForm())
            {
                form.Show();
                Application.DoEvents();
                Thread.Sleep(250);
                using (Bitmap bitmap = new Bitmap(form.Width, form.Height))
                {
                    form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                    bitmap.Save(path, System.Drawing.Imaging.ImageFormat.Png);
                }
                form.Close();
            }
        }
    }

    internal static class SelfTest
    {
        public static bool Run()
        {
            try
            {
                GuardianConfig original = new GuardianConfig();
                original.Active = true;
                original.Strict = true;
                original.AllowFirefox = false;
                original.AllowManagedChrome = true;
                original.KeepWarpConnected = false;
                original.LegacyAirPodsStereo = true;
                original.PausedUntilUtc = new DateTime(638900000000000000L, DateTimeKind.Utc);
                GuardianConfig parsed = GuardianConfig.Parse(original.Serialize());
                Assert(parsed.Active, "active round trip");
                Assert(!parsed.AllowFirefox, "Firefox round trip");
                Assert(parsed.AllowManagedChrome, "Chrome round trip");
                Assert(parsed.LegacyAirPodsStereo, "legacy AirPods state round trip");
                Assert(parsed.PausedUntilUtc.Ticks == original.PausedUntilUtc.Ticks, "pause round trip");

                AppEntry entry = new AppEntry
                {
                    Id = "custom-test",
                    DisplayName = "Test App",
                    ExecutablePath = @"C:\Program Files\Test App\test.exe",
                    ProcessName = "test",
                    Enabled = true,
                    BuiltIn = false
                };
                AppEntry appParsed = AppEntry.Parse(entry.Serialize());
                Assert(appParsed != null, "app parse");
                Assert(appParsed.DisplayName == entry.DisplayName, "app name round trip");
                Assert(appParsed.ExecutablePath == entry.ExecutablePath, "app path round trip");
                Assert(AppCatalog.IsExplicitlyAllowed("test", entry.ExecutablePath, new List<AppEntry> { appParsed }), "exact-path allow");

                Assert(ProcessGuard.IsCoreAllowed("codex", ""), "Codex core allow");
                Assert(ProcessGuard.IsCoreAllowed("other", @"D:\Test\OpenAI.Codex_test\app.exe"), "packaged Codex allow");
                return true;
            }
            catch (Exception ex)
            {
                AppLog.Write("Self-test failed: " + ex.Message);
                return false;
            }
        }

        private static void Assert(bool condition, string name)
        {
            if (!condition) throw new InvalidOperationException("Self-test assertion failed: " + name);
        }
    }
}
