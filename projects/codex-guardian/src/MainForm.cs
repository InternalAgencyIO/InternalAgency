using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace CodexGuardian
{
    internal sealed class GuardianContext : ApplicationContext
    {
        private readonly NotifyIcon tray;
        private readonly System.Windows.Forms.Timer timer;
        private int ticks;
        private int sweepRunning;
        private MainForm window;
        private MainWindowLease windowLease;

        public GuardianContext()
        {
            Paths.Ensure();
            tray = new NotifyIcon();
            tray.Icon = SystemIcons.Shield;
            tray.Text = "Codex Guardian";
            tray.Visible = true;

            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("Open Guardian", null, delegate { ShowWindow(); });
            menu.Items.Add("Enable Guardian", null, delegate { GuardianState.ConfirmAndEnable(null); });
            menu.Items.Add("Pause 15 minutes", null, delegate { GuardianState.Pause(15); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Emergency stop", null, delegate { GuardianState.EmergencyStop(); });
            menu.Items.Add("Exit tray app", null, delegate
            {
                GuardianState.EmergencyStop();
                tray.Visible = false;
                timer.Stop();
                ExitThread();
            });
            tray.ContextMenuStrip = menu;
            tray.DoubleClick += delegate { ShowWindow(); };

            timer = new System.Windows.Forms.Timer();
            timer.Interval = 2500;
            timer.Tick += Tick;
            timer.Start();
            AppLog.Write("Watchdog started.");
        }

        private void ShowWindow()
        {
            if (window == null || window.IsDisposed)
            {
                if (windowLease != null)
                {
                    windowLease.Dispose();
                    windowLease = null;
                }
                if (!MainWindowLease.TryAcquire(out windowLease))
                {
                    MessageBox.Show(
                        "Codex Guardian is already open. Use the existing window or close it before opening the tray window.",
                        "Codex Guardian",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                    return;
                }
                try
                {
                    window = new MainForm();
                    window.FormClosed += delegate
                    {
                        window = null;
                        windowLease.Dispose();
                        windowLease = null;
                    };
                }
                catch
                {
                    windowLease.Dispose();
                    windowLease = null;
                    throw;
                }
            }
            window.Show();
            if (window.WindowState == FormWindowState.Minimized) window.WindowState = FormWindowState.Normal;
            window.Activate();
        }

        private void Tick(object sender, EventArgs e)
        {
            ticks++;
            GuardianConfig config = GuardianConfig.Load();
            tray.Icon = config.IsEnforcing ? SystemIcons.Shield : SystemIcons.Information;
            tray.Text = config.IsEnforcing ? "Codex Guardian - ACTIVE" : "Codex Guardian - paused/off";

            if (!config.IsEnforcing || Interlocked.CompareExchange(ref sweepRunning, 1, 0) != 0) return;
            bool checkWarp = ticks % 24 == 0;
            bool queued = ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    GuardianConfig current = GuardianConfig.Load();
                    if (!current.IsEnforcing) return;
                    ProcessGuard.Enforce(current);
                    current = GuardianConfig.Load();
                    if (checkWarp && current.IsEnforcing && current.KeepWarpConnected) Launchers.EnsureWarpConnected();
                }
                catch (Exception ex)
                {
                    AppLog.Write("Enforcement sweep failed: " + ex.Message);
                }
                finally
                {
                    Interlocked.Exchange(ref sweepRunning, 0);
                }
            });
            if (!queued) Interlocked.Exchange(ref sweepRunning, 0);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                timer.Dispose();
                tray.Dispose();
                if (window != null) window.Dispose();
                if (windowLease != null)
                {
                    windowLease.Dispose();
                    windowLease = null;
                }
            }
            base.Dispose(disposing);
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly Color Background = Color.FromArgb(18, 22, 28);
        private readonly Color Panel = Color.FromArgb(28, 34, 43);
        private readonly Color Green = Color.FromArgb(101, 219, 166);
        private readonly Color Amber = Color.FromArgb(236, 175, 86);
        private readonly Color Red = Color.FromArgb(196, 79, 73);
        private readonly Color Blue = Color.FromArgb(67, 111, 174);

        private Label status;
        private Label details;
        private ListView appList;
        private CheckBox keepWarp;
        private CheckBox startWithWindows;
        private Button removeApp;
        private Button launchApp;
        private System.Windows.Forms.Timer refresh;
        private bool loading;
        private bool eventsReady;

        public MainForm()
        {
            Text = "Codex Guardian";
            ClientSize = new Size(760, 660);
            MinimumSize = new Size(620, 420);
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.Dpi;
            AutoScroll = true;
            BackColor = Background;
            ForeColor = Color.WhiteSmoke;
            Font = new Font("Segoe UI", 9.5F);
            Icon = SystemIcons.Shield;

            BuildHeader();
            BuildModeControls();
            BuildAppControls();
            BuildOptions();
            BuildMaintenance();

            refresh = new System.Windows.Forms.Timer();
            refresh.Interval = 2000;
            refresh.Tick += delegate { RefreshStatus(); };
            refresh.Start();
            FormClosed += delegate { refresh.Dispose(); };
            Shown += delegate
            {
                Rectangle work = Screen.FromControl(this).WorkingArea;
                if (Height > work.Height - 20) Height = Math.Max(MinimumSize.Height, work.Height - 20);
                if (Width > work.Width - 20) Width = Math.Max(MinimumSize.Width, work.Width - 20);
                BeginInvoke(new MethodInvoker(delegate { eventsReady = true; }));
            };

            LoadApps();
            RefreshStatus();
        }

        private void BuildHeader()
        {
            Label title = new Label();
            title.Text = "CODEX  GUARDIAN";
            title.Font = new Font("Segoe UI Semibold", 22F, FontStyle.Bold);
            title.ForeColor = Green;
            title.Location = new Point(26, 10);
            title.AutoSize = true;
            Controls.Add(title);

            Label subtitle = new Label();
            subtitle.Text = "A focused Windows workspace. You choose which apps stay open.";
            subtitle.ForeColor = Color.Silver;
            subtitle.Location = new Point(29, 53);
            subtitle.AutoSize = true;
            Controls.Add(subtitle);

            status = new Label();
            status.Font = new Font("Segoe UI Semibold", 14F, FontStyle.Bold);
            status.Location = new Point(29, 80);
            status.Size = new Size(700, 31);
            Controls.Add(status);

            details = new Label();
            details.ForeColor = Color.Gainsboro;
            details.Location = new Point(31, 111);
            details.Size = new Size(690, 24);
            Controls.Add(details);
        }

        private void BuildModeControls()
        {
            AddButton("ENABLE GUARDIAN", 31, 140, 217, 42, Color.FromArgb(45, 145, 105), delegate
            {
                if (GuardianState.ConfirmAndEnable(this)) RefreshStatus();
            });

            AddButton("PAUSE 15 MINUTES", 260, 140, 217, 42, Color.FromArgb(77, 91, 112), delegate
            {
                GuardianState.Pause(15);
                RefreshStatus();
            });

            AddButton("EMERGENCY STOP", 489, 140, 240, 42, Red, delegate
            {
                GuardianState.EmergencyStop();
                RefreshStatus();
            });
        }

        private void BuildAppControls()
        {
            Label heading = new Label();
            heading.Text = "Allowed apps";
            heading.Font = new Font("Segoe UI Semibold", 12F, FontStyle.Bold);
            heading.Location = new Point(29, 198);
            heading.AutoSize = true;
            Controls.Add(heading);

            Label note = new Label();
            note.Text = "Windows, Codex, terminals, dev tools, WSL and Hyper-V are always allowed.";
            note.ForeColor = Color.Silver;
            note.Location = new Point(31, 226);
            note.Size = new Size(690, 20);
            Controls.Add(note);

            appList = new ListView();
            appList.Location = new Point(31, 250);
            appList.Size = new Size(698, 190);
            appList.View = View.Details;
            appList.CheckBoxes = true;
            appList.FullRowSelect = true;
            appList.HideSelection = false;
            appList.BackColor = Panel;
            appList.ForeColor = Color.WhiteSmoke;
            appList.BorderStyle = BorderStyle.FixedSingle;
            appList.Columns.Add("Application", 270);
            appList.Columns.Add("Executable", 405);
            appList.ItemChecked += AppChecked;
            appList.SelectedIndexChanged += delegate { UpdateAppButtons(); };
            appList.DoubleClick += delegate { LaunchSelected(); };
            Controls.Add(appList);

            AddButton("ADD APP...", 31, 450, 145, 38, Blue, delegate { AddApp(); });
            removeApp = AddButton("REMOVE", 187, 450, 145, 38, Color.FromArgb(93, 84, 135), delegate { RemoveSelected(); });
            launchApp = AddButton("LAUNCH", 343, 450, 145, 38, Color.FromArgb(45, 145, 105), delegate { LaunchSelected(); });
            AddButton("APP DATA", 584, 450, 145, 38, Color.FromArgb(77, 91, 112), delegate
            {
                Paths.Ensure();
                Shell.Run(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "explorer.exe"), "\"" + Paths.UserRoot + "\"", false, false);
            });
        }

        private void BuildOptions()
        {
            GroupBox group = new GroupBox();
            group.Text = "Options";
            group.Location = new Point(31, 500);
            group.Size = new Size(698, 65);
            group.ForeColor = Color.Gainsboro;
            Controls.Add(group);

            keepWarp = new CheckBox();
            keepWarp.Text = "Keep Cloudflare WARP connected";
            keepWarp.Location = new Point(18, 29);
            keepWarp.AutoSize = true;
            keepWarp.CheckedChanged += delegate
            {
                if (loading) return;
                GuardianConfig.Update(delegate(GuardianConfig config) { config.KeepWarpConnected = keepWarp.Checked; });
            };
            group.Controls.Add(keepWarp);

            startWithWindows = new CheckBox();
            startWithWindows.Text = "Start Guardian at sign-in";
            startWithWindows.Location = new Point(350, 29);
            startWithWindows.AutoSize = true;
            startWithWindows.CheckedChanged += delegate
            {
                if (loading) return;
                Persistence.SetEnabled(startWithWindows.Checked, true);
            };
            group.Controls.Add(startWithWindows);
        }

        private void BuildMaintenance()
        {
            Label label = new Label();
            label.Text = "Optional helpers";
            label.Font = new Font("Segoe UI Semibold", 10F, FontStyle.Bold);
            label.Location = new Point(31, 578);
            label.AutoSize = true;
            Controls.Add(label);

            AddButton("FOCUS CLEANUP", 31, 607, 215, 35, Color.FromArgb(101, 82, 58), delegate
            {
                if (MessageBox.Show(
                    "Apply five reversible current-user Windows settings for fewer suggestions, advertising prompts and Game DVR activity?\n\nNo services, startup apps, drivers or files are changed.",
                    "Focus cleanup",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question) == DialogResult.Yes) FocusCleanup.Apply();
            });
            AddButton("RESTORE CLEANUP", 258, 607, 215, 35, Color.FromArgb(85, 75, 75), delegate { FocusCleanup.Restore(); });
            AddButton("OPEN LOG", 485, 607, 244, 35, Color.FromArgb(77, 91, 112), delegate
            {
                Paths.Ensure();
                if (!File.Exists(Paths.Log)) File.WriteAllText(Paths.Log, "", Encoding.UTF8);
                Shell.Run(Path.Combine(Environment.SystemDirectory, "notepad.exe"), "\"" + Paths.Log + "\"", false, false);
            });
        }

        private Button AddButton(string text, int x, int y, int width, int height, Color color, EventHandler click)
        {
            Button button = new Button();
            button.Text = text;
            button.Location = new Point(x, y);
            button.Size = new Size(width, height);
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 0;
            button.BackColor = color;
            button.ForeColor = Color.White;
            button.Cursor = Cursors.Hand;
            button.Click += click;
            Controls.Add(button);
            return button;
        }

        private void LoadApps()
        {
            loading = true;
            try
            {
                appList.Items.Clear();
                GuardianConfig config = GuardianConfig.Load();
                foreach (AppEntry entry in AppCatalog.Load(config))
                {
                    ListViewItem item = new ListViewItem(entry.DisplayName);
                    item.SubItems.Add(entry.ExecutablePath.Length > 0 ? entry.ExecutablePath : "Not found - add another app if you use a different browser");
                    item.Tag = entry;
                    item.Checked = entry.Enabled;
                    if (entry.ExecutablePath.Length == 0) item.ForeColor = Color.Silver;
                    appList.Items.Add(item);
                }
            }
            finally
            {
                loading = false;
            }
            UpdateAppButtons();
        }

        private void AppChecked(object sender, ItemCheckedEventArgs e)
        {
            if (loading || !eventsReady) return;
            BeginInvoke(new MethodInvoker(delegate
            {
                AppEntry changed = (AppEntry)e.Item.Tag;
                changed.Enabled = e.Item.Checked;
                SaveApps();
            }));
        }

        private void SaveApps()
        {
            List<AppEntry> entries = appList.Items.Cast<ListViewItem>()
                .Select(delegate(ListViewItem item)
                {
                    AppEntry entry = (AppEntry)item.Tag;
                    entry.Enabled = item.Checked;
                    return entry;
                }).ToList();
            AppCatalog.Save(entries);
        }

        private void AddApp()
        {
            using (OpenFileDialog dialog = new OpenFileDialog())
            {
                dialog.Title = "Choose an application to allow";
                dialog.Filter = "Windows applications (*.exe)|*.exe";
                dialog.CheckFileExists = true;
                if (dialog.ShowDialog(this) != DialogResult.OK) return;

                string path = AppDiscovery.NormalizePath(dialog.FileName);
                foreach (ListViewItem existing in appList.Items)
                {
                    AppEntry existingEntry = (AppEntry)existing.Tag;
                    if (existingEntry.Id != AppCatalog.ManagedChromeId && existingEntry.ExecutablePath.Equals(path, StringComparison.OrdinalIgnoreCase))
                    {
                        existing.Checked = true;
                        existing.Selected = true;
                        return;
                    }
                }

                string display = Path.GetFileNameWithoutExtension(path);
                try
                {
                    FileVersionInfo version = FileVersionInfo.GetVersionInfo(path);
                    if (!String.IsNullOrWhiteSpace(version.FileDescription)) display = version.FileDescription;
                }
                catch { }
                AppEntry entry = new AppEntry
                {
                    Id = "custom-" + Guid.NewGuid().ToString("N"),
                    DisplayName = display,
                    ExecutablePath = path,
                    ProcessName = Path.GetFileNameWithoutExtension(path),
                    Enabled = true,
                    BuiltIn = false
                };
                ListViewItem item = new ListViewItem(entry.DisplayName);
                item.SubItems.Add(entry.ExecutablePath);
                item.Tag = entry;
                item.Checked = true;
                appList.Items.Add(item);
                SaveApps();
                item.Selected = true;
                item.EnsureVisible();
            }
        }

        private void RemoveSelected()
        {
            if (appList.SelectedItems.Count == 0) return;
            ListViewItem item = appList.SelectedItems[0];
            AppEntry entry = (AppEntry)item.Tag;
            if (entry.BuiltIn)
            {
                MessageBox.Show("Built-in browser rows can be unchecked but not removed.", "Codex Guardian", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            appList.Items.Remove(item);
            SaveApps();
            UpdateAppButtons();
        }

        private void LaunchSelected()
        {
            if (appList.SelectedItems.Count == 0) return;
            ListViewItem item = appList.SelectedItems[0];
            AppEntry entry = (AppEntry)item.Tag;
            if (!item.Checked)
            {
                item.Checked = true;
                entry.Enabled = true;
                SaveApps();
            }
            Launchers.Launch(entry);
        }

        private void UpdateAppButtons()
        {
            bool selected = appList.SelectedItems.Count > 0;
            launchApp.Enabled = selected;
            removeApp.Enabled = selected;
        }

        private void RefreshStatus()
        {
            GuardianConfig config = GuardianConfig.Load();
            if (config.IsEnforcing)
            {
                status.Text = "● ACTIVE - unapproved apps stay closed";
                status.ForeColor = Green;
            }
            else if (config.Active)
            {
                TimeSpan remaining = config.PausedUntilUtc - DateTime.UtcNow;
                status.Text = remaining.TotalSeconds > 0
                    ? "● PAUSED - resumes in " + Math.Max(1, (int)Math.Ceiling(remaining.TotalMinutes)) + " min"
                    : "● READY";
                status.ForeColor = Amber;
            }
            else
            {
                status.Text = "○ OFF - no apps are being closed";
                status.ForeColor = Amber;
            }

            bool watchdog = Persistence.IsWatchdogRunning();
            details.Text = "Tray watchdog: " + (watchdog ? "running" : "not detected") +
                           "     |     Focus cleanup: " + (FocusCleanup.HasBackup ? "applied" : "not applied");

            loading = true;
            keepWarp.Checked = config.KeepWarpConnected;
            startWithWindows.Checked = Persistence.IsEnabled();
            loading = false;
        }
    }
}
