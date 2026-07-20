import { describe, it, expect } from "vitest";
import { zonaDesdePath } from "./zona";

describe("zonaDesdePath", () => {
  it("rutas publicas de invitados", () => {
    expect(zonaDesdePath("/invitacion/boda/abc")).toBe("invitacion-publica");
    expect(zonaDesdePath("/mesa/xyz")).toBe("invitacion-publica");
    expect(zonaDesdePath("/playlist/tok")).toBe("invitacion-publica");
  });
  it("rutas del planner", () => {
    expect(zonaDesdePath("/events/1")).toBe("planner");
    expect(zonaDesdePath("/dashboard")).toBe("planner");
    expect(zonaDesdePath("/perfil")).toBe("planner");
    expect(zonaDesdePath("/admin")).toBe("planner");
  });
  it("cae a general en lo desconocido o vacio", () => {
    expect(zonaDesdePath("/")).toBe("general");
    expect(zonaDesdePath("/privacidad")).toBe("general");
    expect(zonaDesdePath(undefined)).toBe("general");
  });
});
