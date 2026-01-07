"use client";

import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Button as MuiButton,
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { Save, Bell, Moon, Globe, Lock, Eye } from "lucide-react";
import SaveIcon from "@mui/icons-material/Save";
import NotificationsIcon from "@mui/icons-material/Notifications";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    darkMode: false,
    language: "en",
    autoSave: true,
    soundEffects: true,
    theme: "default",
    fontSize: 14,
    compactView: false,
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header with inconsistent styling */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            Settings
          </h1>
          <p className="text-gray-600 text-base">Customize your experience</p>
        </div>

        <div className="space-y-6">
          {/* Notifications section - Shadcn Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <CardTitle>Notification Preferences</CardTitle>
              </div>
              <CardDescription>
                Choose how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900">
                    Email Notifications
                  </p>
                  <p className="text-sm text-gray-500">
                    Receive updates via email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      emailNotifications: e.target.checked,
                    })
                  }
                  color="primary"
                />
              </div>
              <Divider />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-semibold text-gray-800">
                    Push Notifications
                  </p>
                  <p className="text-xs text-gray-400">
                    Get browser notifications
                  </p>
                </div>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.pushNotifications}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          pushNotifications: e.target.checked,
                        })
                      }
                      color="success"
                    />
                  }
                  label=""
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance section - Different card style */}
          <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <Moon className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">Appearance</h2>
            </div>

            <div className="space-y-6">
              {/* Dark mode with different toggle style */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Dark Mode
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Enable dark theme
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.darkMode}
                      onChange={(e) =>
                        setSettings({ ...settings, darkMode: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Theme selector with inconsistent styling */}
              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <label className="block text-base font-medium text-gray-700 mb-3">
                  Color Theme
                </label>
                <ToggleButtonGroup
                  value={settings.theme}
                  exclusive
                  onChange={(e, value) =>
                    value && setSettings({ ...settings, theme: value })
                  }
                  size="small"
                >
                  <ToggleButton value="default">Default</ToggleButton>
                  <ToggleButton value="blue">Blue</ToggleButton>
                  <ToggleButton value="green">Green</ToggleButton>
                  <ToggleButton value="purple">Purple</ToggleButton>
                </ToggleButtonGroup>
              </div>

              {/* Font size with MUI Slider */}
              <div className="pt-2">
                <p className="font-semibold text-gray-900 mb-4">Font Size</p>
                <Slider
                  value={settings.fontSize}
                  onChange={(e, value) =>
                    setSettings({ ...settings, fontSize: value as number })
                  }
                  min={12}
                  max={20}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  color="secondary"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>

              {/* Compact view with yet another style */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-5 rounded-md">
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.compactView}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          compactView: e.target.checked,
                        })
                      }
                      color="secondary"
                    />
                  }
                  label={
                    <div>
                      <span className="font-medium text-gray-800">
                        Compact View
                      </span>
                      <p className="text-sm text-gray-600">
                        Show more items on screen
                      </p>
                    </div>
                  }
                />
              </div>
            </div>
          </div>

          {/* Language & Region - Another different style */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-5">
              <Globe className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-bold text-gray-800">
                Language & Region
              </h2>
            </div>

            <FormControl fullWidth>
              <InputLabel>Language</InputLabel>
              <Select
                value={settings.language}
                label="Language"
                onChange={(e) =>
                  setSettings({ ...settings, language: e.target.value })
                }
              >
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="es">Spanish</MenuItem>
                <MenuItem value="fr">French</MenuItem>
                <MenuItem value="de">German</MenuItem>
                <MenuItem value="ja">Japanese</MenuItem>
              </Select>
            </FormControl>
          </div>

          {/* Advanced Settings - Card with different structure */}
          <Card className="border-2 border-orange-200">
            <CardHeader className="bg-orange-50">
              <CardTitle className="text-orange-900 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Advanced Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-bold text-gray-900 text-base">Auto-Save</p>
                  <p className="text-gray-600 text-sm">
                    Automatically save changes
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) =>
                    setSettings({ ...settings, autoSave: e.target.checked })
                  }
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">Sound Effects</p>
                  <p className="text-sm text-gray-500">
                    Play sounds for actions
                  </p>
                </div>
                <Switch
                  checked={settings.soundEffects}
                  onChange={(e) =>
                    setSettings({ ...settings, soundEffects: e.target.checked })
                  }
                  color="warning"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save buttons with multiple inconsistent styles */}
          <div className="flex flex-wrap gap-4 justify-end pt-4">
            <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">
              Reset to Defaults
            </button>
            <Button variant="outline" size="lg">
              Cancel
            </Button>
            <Button variant="default" size="lg">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
            <MuiButton
              variant="contained"
              color="success"
              size="large"
              startIcon={<SaveIcon />}
              sx={{ textTransform: "none", fontWeight: "bold" }}
            >
              Save All Changes
            </MuiButton>
          </div>
        </div>
      </div>
    </div>
  );
}
