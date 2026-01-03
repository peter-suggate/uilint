import type { NextConfig } from "next";
import { withJsxLoc } from "jsx-loc-plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["uilint-react"],
};

export default withJsxLoc(nextConfig);
