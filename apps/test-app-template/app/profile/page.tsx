"use client";

import { useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Button as MuiButton,
  TextField,
  Avatar,
  Chip,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider as MuiDivider,
} from "@mui/material";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Edit,
  Camera,
} from "lucide-react";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    bio: "Product designer and developer passionate about creating beautiful and functional user interfaces.",
    joinDate: "January 2023",
    tasksCompleted: 127,
    activeProjects: 8,
    achievements: ["Early Adopter", "Task Master", "Team Player"],
  });

  const [theme, setTheme] = useState("light");
  const [darkMode, setDarkMode] = useState(false);
  const [colorMode, setColorMode] = useState("light");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header with inconsistent card styles */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Avatar section - MUI style */}
            <div className="relative">
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  bgcolor: "primary.main",
                  fontSize: "3rem",
                }}
              >
                {profile.name.charAt(0)}
              </Avatar>
              <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 shadow-lg">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Profile info with mixed styles */}
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <Input
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                    className="text-xl font-bold"
                  />
                  <TextField
                    fullWidth
                    size="small"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                    {profile.name}
                  </h1>
                  <p className="text-lg text-gray-600 mb-3">{profile.email}</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip label="Pro User" color="primary" size="small" />
                    <Chip label="Verified" color="success" size="small" />
                    <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full">
                      Premium
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Action buttons - inconsistent placement */}
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button onClick={() => setIsEditing(false)} variant="outline">
                    Cancel
                  </Button>
                  <MuiButton variant="contained" color="success">
                    Save Profile
                  </MuiButton>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium shadow"
                >
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Contact Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact card - Shadcn style */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-green-600 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{profile.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-red-600 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-gray-900">
                      {profile.location}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats card - different style */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Statistics
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-blue-100 text-sm">Tasks Completed</p>
                  <p className="text-3xl font-bold">{profile.tasksCompleted}</p>
                </div>
                <MuiDivider sx={{ bgcolor: "rgba(255,255,255,0.2)" }} />
                <div>
                  <p className="text-blue-100 text-sm">Active Projects</p>
                  <p className="text-3xl font-bold">{profile.activeProjects}</p>
                </div>
                <MuiDivider sx={{ bgcolor: "rgba(255,255,255,0.2)" }} />
                <div>
                  <p className="text-blue-100 text-sm">Member Since</p>
                  <p className="text-lg font-semibold">{profile.joinDate}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Bio and Achievements */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bio section - plain div with border */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                About Me
              </h2>
              {isEditing ? (
                <textarea
                  value={profile.bio}
                  onChange={(e) =>
                    setProfile({ ...profile, bio: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                />
              ) : (
                <p className="text-gray-700 leading-relaxed text-base">
                  {profile.bio}
                </p>
              )}
            </div>

            {/* Achievements - MUI Paper */}
            <Paper elevation={3} sx={{ p: 3 }}>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-600" />
                Achievements
              </h2>
              <div className="flex flex-wrap gap-3 mb-6">
                {profile.achievements.map((achievement, idx) => (
                  <Chip
                    key={idx}
                    label={achievement}
                    color="warning"
                    variant="outlined"
                    icon={<Award />}
                  />
                ))}
              </div>

              {/* Progress bars with inconsistent styles */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Profile Completion
                    </span>
                    <span className="text-sm font-bold text-blue-600">85%</span>
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={85}
                    color="primary"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600">
                      Productivity Score
                    </span>
                    <span className="text-xs text-green-600">92%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: "92%" }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-700">
                      Activity Level
                    </span>
                    <span className="text-sm text-purple-600 font-medium">
                      78%
                    </span>
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={78}
                    color="secondary"
                  />
                </div>
              </div>
            </Paper>

            {/* Recent Activity - MUI List with different styling */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gray-50 border-b">
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </ListItemIcon>
                    <ListItemText
                      primary="Completed 'Design new landing page'"
                      secondary="2 hours ago"
                      primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                    />
                  </ListItem>
                  <MuiDivider />
                  <ListItem>
                    <ListItemIcon>
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </ListItemIcon>
                    <ListItemText
                      primary="Added 3 new tasks"
                      secondary="5 hours ago"
                      primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                    />
                  </ListItem>
                  <MuiDivider />
                  <ListItem>
                    <ListItemIcon>
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    </ListItemIcon>
                    <ListItemText
                      primary="Updated profile information"
                      secondary="1 day ago"
                      primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
