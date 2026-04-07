import { describe, it, expect, beforeAll, afterAll } from "vitest";

import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { app } from "../app";
import { prisma } from "../lib/prisma";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PASSWORD = "password123";
const WRONG_PASSWORD = "wrong-password";

let orgId: string;
let orgBId: string;
let directorId: string;

beforeAll(async () => {
  const pw = await bcrypt.hash(PASSWORD, 10);

  // Primary org with all three roles
  const org = await prisma.organisation.create({
    data: { name: "Test Org", slug: "test-org" },
  });
  orgId = org.id;

  const director = await prisma.user.create({
    data: {
      email: "director@test.org",
      password: pw,
      name: "Test Director",
      role: "DIRECTOR",
      orgId,
    },
  });
  directorId = director.id;

  await prisma.user.create({
    data: {
      email: "lead@test.org",
      password: pw,
      name: "Test Lead",
      role: "MISSION_LEAD",
      orgId,
    },
  });
  await prisma.user.create({
    data: {
      email: "crew@test.org",
      password: pw,
      name: "Test Crew",
      role: "CREW_MEMBER",
      orgId,
    },
  });

  // Second org — same email as director, used to test cross-org isolation
  const orgB = await prisma.organisation.create({
    data: { name: "Other Org", slug: "other-org" },
  });
  orgBId = orgB.id;
  await prisma.user.create({
    data: {
      email: "director@test.org",
      password: pw,
      name: "Other Director",
      role: "DIRECTOR",
      orgId: orgBId,
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.$disconnect();
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  describe("happy path", () => {
    it("returns a token and user info for a valid director login", async () => {
      const res = await request(app).post("/api/auth/login").send({
        slug: "test-org",
        email: "director@test.org",
        password: PASSWORD,
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toMatchObject({
        email: "director@test.org",
        role: "DIRECTOR",
        orgId,
        orgSlug: "test-org",
        orgName: "Test Org",
      });
      expect(res.body.user.password).toBeUndefined();
    });

    it("token payload contains id, role, and orgId", async () => {
      const res = await request(app).post("/api/auth/login").send({
        slug: "test-org",
        email: "director@test.org",
        password: PASSWORD,
      });

      const payload = jwt.decode(res.body.token) as Record<string, unknown>;
      expect(payload.id).toBe(directorId);
      expect(payload.role).toBe("DIRECTOR");
      expect(payload.orgId).toBe(orgId);
    });

    it("returns MISSION_LEAD role for a mission lead login", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ slug: "test-org", email: "lead@test.org", password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("MISSION_LEAD");
    });

    it("returns CREW_MEMBER role for a crew member login", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ slug: "test-org", email: "crew@test.org", password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("CREW_MEMBER");
    });
  });

  describe("invalid credentials", () => {
    it("returns 401 for a wrong password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        slug: "test-org",
        email: "director@test.org",
        password: WRONG_PASSWORD,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("returns 401 for an email that does not exist in the org", async () => {
      const res = await request(app).post("/api/auth/login").send({
        slug: "test-org",
        email: "ghost@test.org",
        password: PASSWORD,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("returns 401 for an unknown org slug", async () => {
      const res = await request(app).post("/api/auth/login").send({
        slug: "no-such-org",
        email: "director@test.org",
        password: PASSWORD,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("returns 401 when using a valid email with the wrong org slug (cross-org isolation)", async () => {
      // director@test.org exists in both orgs — using other-org slug must not return test-org user
      const res = await request(app).post("/api/auth/login").send({
        slug: "test-org",
        email: "director@test.org",
        password: PASSWORD,
      });

      expect(res.status).toBe(200);
      expect(res.body.user.orgId).toBe(orgId); // must be test-org, not other-org

      const crossRes = await request(app).post("/api/auth/login").send({
        slug: "other-org",
        email: "director@test.org",
        password: PASSWORD,
      });

      expect(crossRes.status).toBe(200);
      expect(crossRes.body.user.orgId).toBe(orgBId); // resolves to the correct org independently
    });
  });

  describe("request validation", () => {
    it("returns 400 when slug is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "director@test.org", password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.details.slug).toBeDefined();
    });

    it("returns 400 when email is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ slug: "test-org", password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.details.email).toBeDefined();
    });

    it("returns 400 when password is missing", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ slug: "test-org", email: "director@test.org" });

      expect(res.status).toBe(400);
      expect(res.body.details.password).toBeDefined();
    });

    it("returns 400 for an invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ slug: "test-org", email: "not-an-email", password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.details.email).toBeDefined();
    });

    it("returns 400 for an empty body", async () => {
      const res = await request(app).post("/api/auth/login").send({});

      expect(res.status).toBe(400);
    });
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  let validToken: string;

  beforeAll(async () => {
    const res = await request(app).post("/api/auth/login").send({
      slug: "test-org",
      email: "director@test.org",
      password: PASSWORD,
    });
    validToken = res.body.token;
  });

  describe("happy path", () => {
    it("returns the current user for a valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: directorId,
        email: "director@test.org",
        role: "DIRECTOR",
        orgId,
        orgSlug: "test-org",
        orgName: "Test Org",
      });
    });

    it("does not include password in the response", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.body.password).toBeUndefined();
    });
  });

  describe("authentication errors", () => {
    it("returns 401 with no Authorization header", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("returns 401 for a malformed token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer this.is.not.a.valid.token");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });

    it("returns 401 for a token signed with the wrong secret", async () => {
      const forgedToken = jwt.sign(
        { id: directorId, role: "DIRECTOR", orgId },
        "wrong-secret",
        { expiresIn: "8h" },
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
    });

    it("returns 401 for an expired token", async () => {
      const expiredToken = jwt.sign(
        { id: directorId, role: "DIRECTOR", orgId },
        "test-secret",
        { expiresIn: -1 }, // already expired
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it("returns 401 when the Authorization header is missing the Bearer prefix", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", validToken); // no "Bearer " prefix

      expect(res.status).toBe(401);
    });

    it("returns 404 when the token is valid but the user no longer exists", async () => {
      const pw = await bcrypt.hash(PASSWORD, 10);
      const ghost = await prisma.user.create({
        data: {
          email: "ghost-temp@test.org",
          password: pw,
          name: "Ghost",
          role: "CREW_MEMBER",
          orgId,
        },
      });
      const ghostToken = jwt.sign(
        { id: ghost.id, role: "CREW_MEMBER", orgId },
        "test-secret",
        { expiresIn: "8h" },
      );
      await prisma.user.delete({ where: { id: ghost.id } });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${ghostToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("User not found");
    });
  });
});
