type UserRole = "admin" | "agency" | null;

type RouteAccessMap = {
  [routeName: string]: UserRole[];
};

export const routeAccess: RouteAccessMap = {
  login: [null],
  bookings: ["admin", "agency"],
};
