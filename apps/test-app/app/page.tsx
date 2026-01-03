"use client";

import {
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
} from "./components/buttons";
import { Card, CardAlt } from "./components/cards";
import { Heading, SubHeading, BodyText } from "./components/typography";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header with intentional inconsistencies */}
        <header>
          <Heading>UILint Test Page</Heading>
          <SubHeading>
            This page has intentional UI inconsistencies for testing
          </SubHeading>
        </header>

        {/* Buttons Section - Inconsistent styles */}
        <section>
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Buttons (Inconsistent)
          </h2>
          <div className="flex flex-wrap gap-4">
            <PrimaryButton>Primary Action</PrimaryButton>
            <SecondaryButton>Secondary</SecondaryButton>
            <OutlineButton>Outline</OutlineButton>

            {/* Intentionally different styling */}
            <button className="bg-blue-500 text-white px-3 py-1 rounded">
              Different Blue
            </button>
            <button className="bg-blue-600 text-white px-5 py-3 rounded-xl">
              Another Blue
            </button>
          </div>
        </section>

        {/* Cards Section - Inconsistent spacing and shadows */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Cards (Inconsistent)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title="Standard Card"
              description="This card uses the standard styling with consistent padding."
            />
            <CardAlt
              title="Alternate Card"
              description="This card has slightly different padding and shadow."
            />

            {/* Intentionally inconsistent inline card */}
            <div className="bg-white p-5 rounded-md shadow border border-gray-100">
              <h3 className="text-lg font-medium text-gray-800">Inline Card</h3>
              <p className="text-gray-500 mt-2 text-sm">
                This card has different padding (p-5), border-radius
                (rounded-md), and includes a border.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg">
              <h3 className="text-lg font-bold text-gray-900">Large Card</h3>
              <p className="text-gray-600 mt-3 text-base">
                This card has larger padding (p-8), bigger radius (rounded-2xl),
                and stronger shadow.
              </p>
            </div>
          </div>
        </section>

        {/* Typography Section - Inconsistent fonts and sizes */}
        <section>
          <h2 className="text-xl font-bold mb-4" style={{ color: "#1f2937" }}>
            Typography (Inconsistent)
          </h2>
          <div className="space-y-4">
            <BodyText>
              This is standard body text using the BodyText component.
            </BodyText>

            {/* Intentionally different text styles */}
            <p className="text-base text-gray-700 leading-relaxed">
              This paragraph uses text-gray-700 instead of the standard color.
            </p>
            <p className="text-sm text-gray-500 leading-normal">
              This text is smaller (text-sm) with different line height.
            </p>
            <p className="text-lg text-gray-800 font-light">
              This text is larger with font-light weight.
            </p>
          </div>
        </section>

        {/* Spacing Section - Inconsistent margins */}
        <section>
          <h2 className="text-xl font-bold mb-6 text-gray-800">
            Spacing (Inconsistent)
          </h2>
          <div className="space-y-3">
            <div className="bg-blue-100 p-4 rounded">Padding: p-4 (16px)</div>
            <div className="bg-blue-100 p-5 rounded">Padding: p-5 (20px)</div>
            <div className="bg-blue-100 p-6 rounded">Padding: p-6 (24px)</div>
            <div className="bg-blue-100 py-3 px-7 rounded">
              Padding: py-3 px-7 (mixed)
            </div>
          </div>
        </section>

        {/* Colors Section - Similar but not identical colors */}
        <section>
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Colors (Similar but Different)
          </h2>
          <div className="flex flex-wrap gap-4">
            <div className="w-20 h-20 bg-blue-500 rounded flex items-center justify-center text-white text-xs">
              blue-500
            </div>
            <div className="w-20 h-20 bg-blue-600 rounded flex items-center justify-center text-white text-xs">
              blue-600
            </div>
            <div
              className="w-20 h-20 rounded flex items-center justify-center text-white text-xs"
              style={{ backgroundColor: "#3B82F6" }}
            >
              #3B82F6
            </div>
            <div
              className="w-20 h-20 rounded flex items-center justify-center text-white text-xs"
              style={{ backgroundColor: "#2563EB" }}
            >
              #2563EB
            </div>
            <div
              className="w-20 h-20 rounded flex items-center justify-center text-white text-xs"
              style={{ backgroundColor: "#3575E2" }}
            >
              #3575E2
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
