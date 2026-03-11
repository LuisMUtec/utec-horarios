import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory storage for rate limiting
// Note: In serverless environments, this is reset periodically, 
// but for basic DDoS/abuse prevention on a small scale, it works.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

const LIMIT = 1000; // Max requests
const WINDOW_SIZE = 60 * 60 * 1000; // 1 hour in milliseconds

export function middleware(request: NextRequest) {
  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const now = Date.now();

  const userRate = rateLimitMap.get(ip) || { count: 0, lastReset: now };

  // Reset counter if window has passed
  if (now - userRate.lastReset > WINDOW_SIZE) {
    userRate.count = 0;
    userRate.lastReset = now;
  }

  userRate.count++;
  rateLimitMap.set(ip, userRate);

  if (userRate.count > LIMIT) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { 
        status: 429, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/api/:path*',
};
