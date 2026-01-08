"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
} from "./components/buttons";
import { Card as OldCard, CardAlt } from "./components/cards";
import { Heading, SubHeading, BodyText } from "./components/typography";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  Button as MuiButton,
  Card as MuiCard,
  CardContent as MuiCardContent,
  Typography,
} from "@mui/material";
import {
  CheckSquare,
  Settings,
  User,
  ArrowRight,
  Zap,
  Target,
  TrendingUp,
  X,
} from "lucide-react";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-purple-50">
      {/* Hero Section with deliberate inconsistencies */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Welcome to <span className="text-blue-600">TodoApp</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            A deliberately inconsistent todo application built to test UILint's
            ability to detect UI/UX inconsistencies
          </p>

          {/* Mixed button styles */}
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <Link href="/todos">
              <Button size="lg" className="text-base">
                <CheckSquare className="w-5 h-5 mr-2" />
                View Todos
              </Button>
            </Link>
            <Link href="/todos">
              <MuiButton
                variant="contained"
                size="large"
                color="secondary"
                sx={{ textTransform: "none", fontSize: "16px" }}
              >
                Get Started
              </MuiButton>
            </Link>
            <Link href="/settings">
              <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold text-base">
                Configure Settings
              </button>
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold text-base shadow-[0_4px_14px_0_rgba(147,51,234,0.39)]"
            >
              Open Modal
            </button>
          </div>

          <div className="flex justify-center gap-3">
            <Link href="/profile">
              <button className="text-blue-600 hover:text-blue-800 underline font-medium">
                View Profile
              </button>
            </Link>
            <span className="text-gray-400">•</span>
            <Link
              href="/settings"
              className="text-purple-600 hover:text-purple-800 font-semibold"
            >
              Settings →
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section - Multiple card styles */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 - Shadcn Card */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <CheckSquare className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>Task Management</CardTitle>
                <CardDescription>
                  Organize your tasks with priorities, categories, and due dates
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 2 - MUI Card */}
            <MuiCard sx={{ p: 2, boxShadow: 2 }}>
              <MuiCardContent>
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <Target className="w-7 h-7 text-green-600" />
                </div>
                <Typography
                  variant="h6"
                  component="h3"
                  fontWeight="bold"
                  gutterBottom
                >
                  Goal Tracking
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Set and track your goals with detailed progress monitoring
                </Typography>
              </MuiCardContent>
            </MuiCard>

            {/* Feature 3 - Custom Card */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl shadow-lg border-2 border-purple-200">
              <div className="w-12 h-12 bg-purple-600 rounded-md flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                Analytics
              </h3>
              <p className="text-gray-700 text-sm">
                View insights and statistics about your productivity
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Inconsistency Showcase Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Deliberate Inconsistencies
            </h2>
            <p className="text-lg text-gray-600">
              This app demonstrates various UI inconsistencies that UILint can
              detect
            </p>
          </div>

          <div className="space-y-12">
            {/* Buttons Section - Inconsistent styles */}
            <div>
              <h3 className="text-2xl font-semibold mb-6 text-gray-800">
                Mixed Button Styles
              </h3>
              <div className="flex flex-wrap gap-4">
                <PrimaryButton>Old Primary</PrimaryButton>
                <Button variant="default">Shadcn Button</Button>
                <MuiButton variant="contained">MUI Button</MuiButton>
                <button className="bg-blue-500 text-white px-4 py-2 rounded">
                  Plain Button
                </button>
                <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">
                  Different Blue
                </button>
                <SecondaryButton>Old Secondary</SecondaryButton>
                <Button variant="outline">Outline</Button>
                <MuiButton variant="outlined" color="secondary">
                  MUI Outline
                </MuiButton>
              </div>
            </div>

            {/* Cards Section - Inconsistent spacing and shadows */}
            <div>
              <h3 className="text-2xl font-bold mb-6 text-gray-900">
                Mixed Card Designs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <OldCard
                  title="Legacy Card"
                  description="Uses the old card component with specific padding."
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Shadcn Card</CardTitle>
                    <CardDescription>
                      New card style from shadcn/ui
                    </CardDescription>
                  </CardHeader>
                </Card>

                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">
                    Custom Card
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Inline styled card with different spacing
                  </p>
                </div>

                <CardAlt
                  title="Alt Card"
                  description="Alternative card style with different shadow."
                />

                <div className="bg-white p-8 rounded-2xl shadow-xl">
                  <h4 className="text-xl font-bold text-gray-900">
                    Large Card
                  </h4>
                  <p className="text-gray-600 mt-2">
                    Extra padding and strong shadow
                  </p>
                </div>

                <MuiCard sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    MUI Card
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Material-UI card component
                  </Typography>
                </MuiCard>
              </div>
            </div>

            {/* Typography Section - Inconsistent fonts and sizes */}
            <div>
              <h3
                className="text-xl font-bold mb-4"
                style={{ color: "#1f2937" }}
              >
                Typography Variations
              </h3>
              <div className="space-y-4 bg-white p-6 rounded-lg">
                <Heading>Component Heading</Heading>
                <SubHeading>Component SubHeading</SubHeading>
                <BodyText>
                  Standard body text using the BodyText component.
                </BodyText>
                <p className="text-base text-gray-700 leading-relaxed">
                  Regular paragraph with text-gray-700
                </p>
                <p className="text-sm text-gray-500 leading-normal">
                  Smaller text with text-sm
                </p>
                <p className="text-lg text-gray-800 font-light">
                  Larger text with font-light weight
                </p>
                <Typography variant="body1">
                  MUI Typography component
                </Typography>
              </div>
            </div>

            {/* Colors Section - Similar but not identical colors */}
            <div>
              <h3 className="text-2xl font-semibold mb-6 text-gray-800">
                Color Inconsistencies
              </h3>
              <div className="flex flex-wrap gap-4">
                <div className="w-24 h-24 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xs font-semibold shadow">
                  blue-500
                </div>
                <div className="w-24 h-24 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-semibold shadow">
                  blue-600
                </div>
                <div
                  className="w-24 h-24 rounded-lg flex items-center justify-center text-white text-xs font-semibold shadow"
                  style={{ backgroundColor: "#3B82F6" }}
                >
                  #3B82F6
                </div>
                <div
                  className="w-24 h-24 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-lg"
                  style={{ backgroundColor: "#2563EB" }}
                >
                  #2563EB
                </div>
                <div
                  className="w-24 h-24 rounded-md flex items-center justify-center text-white text-xs shadow-md"
                  style={{ backgroundColor: "#3575E2" }}
                >
                  #3575E2
                </div>
              </div>
            </div>

            {/* Spacing Section - Inconsistent margins and padding */}
            <div className="bg-gray-100 p-8 rounded-xl">
              <h3 className="text-2xl font-bold mb-6 text-gray-800">
                Spacing Variations
              </h3>
              <div className="space-y-4">
                <div className="bg-blue-100 p-4 rounded">
                  Padding: p-4 (16px)
                </div>
                <div className="bg-blue-100 p-5 rounded-lg">
                  Padding: p-5 (20px)
                </div>
                <div className="bg-blue-100 p-6 rounded-xl">
                  Padding: p-6 (24px)
                </div>
                <div className="bg-blue-100 py-3 px-7 rounded-md">
                  Padding: py-3 px-7 (mixed)
                </div>
                <div className="bg-blue-100 p-8 rounded-2xl shadow">
                  Padding: p-8 (32px) with shadow
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-extrabold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Explore the todo app and see how many inconsistencies you can spot!
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/todos">
              <button className="bg-white text-blue-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 shadow-lg">
                Open Todo List
              </button>
            </Link>
            <Link href="/profile">
              <MuiButton
                variant="outlined"
                size="large"
                sx={{
                  color: "white",
                  borderColor: "white",
                  textTransform: "none",
                  fontSize: "18px",
                }}
              >
                View Profile
              </MuiButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Modal with inconsistent dark mode theming */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-[90%] max-w-[600px] bg-white rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] p-[32px] dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - missing dark mode */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-[16px] right-[16px] w-[40px] h-[40px] flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header - has dark mode for text but not background */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Modal Title
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                This modal has inconsistent dark mode theming
              </p>
            </div>

            {/* Content section - missing dark mode entirely */}
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Section One
                </h3>
                <p className="text-gray-700 text-sm">
                  This section has no dark mode classes at all
                </p>
              </div>

              {/* This section has some dark mode but incomplete */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-5 rounded-xl border-2 border-purple-200 dark:from-purple-900/20 dark:to-pink-900/20">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-purple-100 mb-2">
                  Section Two
                </h3>
                <p className="text-gray-700 dark:text-gray-200 text-sm">
                  This section has partial dark mode - background but missing
                  text color for some elements
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-medium">
                    Tag 1
                  </span>
                  <span className="px-3 py-1 bg-pink-500 text-white rounded-full text-xs font-medium dark:bg-pink-600">
                    Tag 2
                  </span>
                </div>
              </div>

              {/* Mixed styling with arbitrary values */}
              <div className="p-[18px] rounded-[12px] bg-white border border-gray-200 shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]">
                <h3 className="text-base font-bold text-gray-900 mb-[10px]">
                  Section Three
                </h3>
                <p className="text-[14px] text-gray-600 leading-[1.6]">
                  This uses arbitrary Tailwind values like p-[18px] and
                  rounded-[12px]
                </p>
              </div>
            </div>

            {/* Footer buttons - inconsistent dark mode */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-lg transition-colors dark:bg-blue-500"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
