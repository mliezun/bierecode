/// <reference path="../.astro/types.d.ts" />

import type { Session, User } from 'better-auth';

declare namespace App {
  interface Locals {
    user: User | null;
    session: Session | null;
  }
}
