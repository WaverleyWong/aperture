"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

const SPRITES = {
  standing: "/sprites/standing.png",
  left1: "/sprites/left1.png",
  left2: "/sprites/left2.png",
  right1: "/sprites/right1.png",
  right2: "/sprites/right2.png",
  jump: "/sprites/jump.png",
};

const SPRITE_SIZE = 80;
const DURATION = 2500; // 2.5 seconds
const FRAME_INTERVAL = 150; // ms per animation frame

type Direction = "left" | "right";
type Waypoint = { x: number; y: number; action: "walk" | "jump" };

function generatePath(): Waypoint[] {
  const w = typeof window !== "undefined" ? window.innerWidth : 800;
  const h = typeof window !== "undefined" ? window.innerHeight : 600;
  const margin = SPRITE_SIZE;

  // Start position
  const startX = margin + Math.random() * (w * 0.3);
  const startY = h * 0.4 + Math.random() * (h * 0.2);

  const points: Waypoint[] = [{ x: startX, y: startY, action: "walk" }];
  const numWaypoints = 5 + Math.floor(Math.random() * 3);

  for (let i = 1; i <= numWaypoints; i++) {
    const progress = i / numWaypoints;
    const baseX = margin + progress * (w - margin * 2);
    const baseY = h * 0.3 + Math.sin(progress * Math.PI * 2 + Math.random()) * (h * 0.15);

    // Occasional jump
    const action = Math.random() < 0.2 ? "jump" : "walk";

    points.push({
      x: baseX + (Math.random() - 0.5) * 100,
      y: Math.max(margin, Math.min(h - margin * 2, baseY)),
      action,
    });
  }

  return points;
}

function interpolatePath(points: Waypoint[], t: number): { x: number; y: number; segIndex: number } {
  const totalSegments = points.length - 1;
  const segment = Math.min(Math.floor(t * totalSegments), totalSegments - 1);
  const localT = (t * totalSegments) - segment;

  const p0 = points[segment];
  const p1 = points[segment + 1];

  // Smooth bezier-like curve
  const ease = localT * localT * (3 - 2 * localT); // smoothstep
  const x = p0.x + (p1.x - p0.x) * ease;

  // Add bounce
  const bounce = Math.sin(localT * Math.PI) * -20;
  const y = p0.y + (p1.y - p0.y) * ease + bounce;

  return { x, y, segIndex: segment };
}

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [frame, setFrame] = useState("standing");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [flipX, setFlipX] = useState(false);

  const pathRef = useRef<Waypoint[]>([]);
  const startTime = useRef(0);
  const frameCount = useRef(0);
  const animRef = useRef<number>(0);
  const lastFrameTime = useRef(0);
  const prevDirection = useRef<Direction>("right");
  const prevSegIndex = useRef(0);

  const animate = useCallback((timestamp: number) => {
    if (!startTime.current) startTime.current = timestamp;
    const elapsed = timestamp - startTime.current;
    const t = Math.min(elapsed / DURATION, 1);

    const path = pathRef.current;
    if (path.length < 2) return;

    const { x, y, segIndex } = interpolatePath(path, t);
    setPos({ x, y });

    // Determine direction
    const currentWaypoint = path[Math.min(segIndex + 1, path.length - 1)];
    const prevWaypoint = path[segIndex];
    const direction: Direction = currentWaypoint.x >= prevWaypoint.x ? "right" : "left";

    // Direction change — show standing briefly
    if (direction !== prevDirection.current || segIndex !== prevSegIndex.current) {
      if (currentWaypoint.action === "jump") {
        setFrame("jump");
        setFlipX(direction === "left");
        prevDirection.current = direction;
        prevSegIndex.current = segIndex;
      } else {
        prevDirection.current = direction;
        prevSegIndex.current = segIndex;
      }
    }

    // Cycle walk frames
    if (timestamp - lastFrameTime.current > FRAME_INTERVAL) {
      lastFrameTime.current = timestamp;
      frameCount.current++;

      const waypoint = path[Math.min(segIndex + 1, path.length - 1)];
      if (waypoint.action === "jump") {
        setFrame("jump");
      } else {
        const cycle = frameCount.current % 4;
        if (direction === "left") {
          setFrame(cycle < 2 ? "left1" : "left2");
          setFlipX(false);
        } else {
          setFrame(cycle < 2 ? "right1" : "right2");
          setFlipX(false);
        }
      }
    }

    if (t < 1) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      // Animation done — show standing, then fade
      setFrame("standing");
      setFading(true);
      setTimeout(() => {
        setVisible(false);
        onComplete();
      }, 400);
    }
  }, [onComplete]);

  useEffect(() => {
    pathRef.current = generatePath();
    if (pathRef.current.length > 0) {
      setPos({ x: pathRef.current[0].x, y: pathRef.current[0].y });
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-400 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "#FBF6ED" }}
    >
      <div
        className="absolute"
        style={{
          left: pos.x - SPRITE_SIZE / 2,
          top: pos.y - SPRITE_SIZE / 2,
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
          transform: flipX ? "scaleX(-1)" : "none",
        }}
      >
        <Image
          src={SPRITES[frame as keyof typeof SPRITES]}
          alt=""
          width={SPRITE_SIZE}
          height={SPRITE_SIZE}
          className="w-full h-full select-none pointer-events-none"
          priority
        />
      </div>
    </div>
  );
}
