/**
 * Simple Spinner component using core ink
 */

import React, { useState, useEffect } from "react";
import { Text } from "ink";

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner(): React.ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prevFrame) => (prevFrame + 1) % frames.length);
    }, 80);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return <Text color="cyan">{frames[frame]}</Text>;
}
