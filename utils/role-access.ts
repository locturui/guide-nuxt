type UserRole = "admin" | "agent" | null;

type RouteAccessMap = {
  [routeName: string]: UserRole[];
};

export const routeAccess: RouteAccessMap = {
  login: [null],
  bookings: ["admin", "agent"],
};
