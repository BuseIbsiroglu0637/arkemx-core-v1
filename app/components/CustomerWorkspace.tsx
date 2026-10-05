"use client";

import { ClientProjectPortal } from "./ClientProjectPortal";

export function CustomerWorkspace({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  return <ClientProjectPortal account={{ displayName, email }}/>;
}
