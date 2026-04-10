/**
 * OpenAPI 3.0 document for GreenPoint App Router APIs.
 * Served at GET /api/openapi with `servers[0].url` set to the request origin.
 */
export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "GreenPoint API",
    description:
      "Next.js App Router HTTP APIs: environmental data, map bundles, auth helpers, and admin utilities. " +
      "Session-protected routes use the Supabase SSR cookie jar after sign-in.",
    version: "1.0.0",
  },
  tags: [
    { name: "Data", description: "Unified environmental and map data (`/api/data`)" },
    { name: "Barangays", description: "Barangay CRUD and lookups" },
    { name: "Users", description: "User listing and creation (legacy Prisma users)" },
    { name: "Recommendations", description: "Greening recommendations" },
    { name: "Profile", description: "Authenticated profile and onboarding" },
    { name: "Auth", description: "Sign-up, OAuth start, session utilities" },
    { name: "Admin", description: "Administrative operations" },
    { name: "Cron", description: "Scheduled cache invalidation" },
    { name: "Utilities", description: "Cost estimates and helpers" },
  ],
  paths: {
    "/api/data": {
      get: {
        tags: ["Data"],
        summary: "Unified data API",
        description:
          "Return either `bundle=map-env` (GeoJSON + raster tile URLs + meta) or a single `resource`. " +
          "Resources `point` and `waqi` require `lat` and `lng`. " +
          "`bundle=map-env` supports optional `include` (comma-separated): lst, ndvi, greeneryindex, gi, greenery, aqi, lsttile, ndvi_tile, canopytile, gi_tile, etc. " +
          "304 + empty body when `If-None-Match` matches ETag for map bundle.",
        parameters: [
          {
            name: "bundle",
            in: "query",
            schema: { type: "string", enum: ["map-env"] },
            description: "Map environment bundle (mutually exclusive with `resource`)",
          },
          {
            name: "include",
            in: "query",
            schema: { type: "string" },
            description: "Subset of map-env layers (optional)",
          },
          {
            name: "resource",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "lst",
                "ndvi",
                "greeneryIndex",
                "aqi",
                "lstTile",
                "ndviTile",
                "canopyTile",
                "giTile",
                "point",
                "waqi",
                "barangays",
              ],
            },
          },
          { name: "lat", in: "query", schema: { type: "string" } },
          { name: "lng", in: "query", schema: { type: "string" } },
          { name: "cityId", in: "query", schema: { type: "string" } },
          { name: "id", in: "query", schema: { type: "string" } },
          { name: "If-None-Match", in: "header", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "JSON body with `ok: true` and `data` or `bundle` + `data`",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "304": { description: "Not modified (map-env bundle only, when ETag matches)" },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "500": {
            description: "Internal error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/barangays": {
      get: {
        tags: ["Barangays"],
        summary: "List or fetch barangays",
        parameters: [
          { name: "cityId", in: "query", schema: { type: "string" } },
          { name: "id", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "{ success: true, data }",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "404": { description: "Barangay not found (when id set)" },
          "500": { description: "Server error" },
        },
      },
      post: {
        tags: ["Barangays"],
        summary: "Create barangay",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BarangayCreateBody" },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Missing required fields" },
          "409": { description: "Duplicate barangay" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/cron/data-pipeline": {
      get: {
        tags: ["Cron"],
        summary: "Revalidate environmental data cache tags",
        security: [{ bearerCron: [] }],
        responses: {
          "200": {
            description: "{ ok: true, revalidated: string[] }",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "401": { description: "Missing or invalid Authorization Bearer" },
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "List users or get one by id",
        parameters: [{ name: "id", in: "query", schema: { type: "string" } }],
        responses: {
          "200": { description: "{ success: true, data }" },
          "404": { description: "User not found" },
          "500": { description: "Server error" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "email", "password"],
                properties: {
                  username: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  role: { type: "string", default: "RESIDENT" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Missing fields" },
          "409": { description: "Already exists" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/recommendations": {
      get: {
        tags: ["Recommendations"],
        summary: "List greening recommendations",
        parameters: [
          { name: "barangayId", in: "query", schema: { type: "string" } },
          { name: "cityId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "priority", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "{ success: true, data: array }" },
          "500": { description: "Server error" },
        },
      },
      post: {
        tags: ["Recommendations"],
        summary: "Create recommendation",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["recommendationID", "name", "description", "interventionType", "relevancy"],
                properties: {
                  recommendationID: { type: "string" },
                  areaID: { type: "string" },
                  cityID: { type: "string" },
                  barangayID: { type: "string" },
                  pointID: { type: "string" },
                  source: { type: "string" },
                  name: { type: "string" },
                  description: { type: "string" },
                  interventionType: { type: "string" },
                  relevancy: { type: "number" },
                  efficiency: { type: "number" },
                  equipmentNeeded: { type: "string" },
                  cost: { type: "number" },
                  costUnit: { type: "string" },
                  equity: { type: "number" },
                  priority: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Validation error" },
          "409": { description: "Duplicate" },
          "500": { description: "Server error" },
        },
      },
      put: {
        tags: ["Recommendations"],
        summary: "Update recommendation",
        description: "Pass recommendation primary key in query: `?id=`",
        parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Updated" },
          "400": { description: "Missing id" },
          "404": { description: "Not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/profile": {
      get: {
        tags: ["Profile"],
        summary: "Get current user profile",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "{ profile, email, emailConfirmedAt, userMetadata }",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "401": { description: "Not signed in" },
          "500": { description: "Server error" },
        },
      },
      patch: {
        tags: ["Profile"],
        summary: "Update profile (upsert)",
        security: [{ cookieAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProfilePatchBody" },
            },
          },
        },
        responses: {
          "200": { description: "{ profile }" },
          "400": { description: "Supabase user update error" },
          "401": { description: "Not signed in" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/profile/onboarding": {
      post: {
        tags: ["Profile"],
        summary: "Complete onboarding",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["firstName", "lastName", "address"],
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  phone: { type: "string", nullable: true },
                  address: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "{ ok: true }" },
          "400": { description: "Validation or Supabase error" },
          "401": { description: "Not signed in" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Legacy Prisma email signup",
        description:
          "Creates `User` (+ optional `CityPlanner` / `Resident`). CITY_PLANNER requires idNumber and idType.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignupBody" },
            },
          },
        },
        responses: {
          "201": { description: "Signup result with nested user/planner/resident" },
          "400": { description: "Validation error" },
          "409": { description: "Duplicate field" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/auth/oauth/{provider}": {
      get: {
        tags: ["Auth"],
        summary: "Start Supabase OAuth",
        description: "302 redirect to identity provider; sets PKCE cookies.",
        parameters: [
          {
            name: "provider",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["google", "facebook", "apple"] },
          },
          {
            name: "next",
            in: "query",
            schema: { type: "string", default: "/home_dashboard" },
            description: "Post-callback in-app path",
          },
        ],
        responses: {
          "302": { description: "Redirect to OAuth provider or login error" },
          "400": { description: "Invalid provider (JSON if not redirect)" },
        },
      },
    },
    "/api/auth/registrant-status": {
      get: {
        tags: ["Auth"],
        summary: "Registration / onboarding flags",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "{ registered, hasCompletedOnboarding }",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "401": { description: "Not signed in" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/auth/signout": {
      post: {
        tags: ["Auth"],
        summary: "Sign out (JSON)",
        responses: {
          "200": { description: "{ ok: true }; clears auth cookies" },
        },
      },
      get: {
        tags: ["Auth"],
        summary: "Sign out (redirect)",
        parameters: [{ name: "next", in: "query", schema: { type: "string", default: "/login" } }],
        responses: {
          "302": { description: "Redirect after clearing cookies" },
        },
      },
    },
    "/api/auth/bootstrap-profile": {
      post: {
        tags: ["Auth"],
        summary: "Ensure Prisma profile stub exists",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "{ ok: true }" },
          "401": { description: "Not signed in" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/auth/check-email": {
      post: {
        tags: ["Auth"],
        summary: "Check if email is registered (Prisma)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "{ registered: boolean } or degraded mode with `degraded: true`",
            content: { "application/json": { schema: { type: "object" } } },
          },
          "400": { description: "Invalid email" },
        },
      },
    },
    "/api/admin/id-verification": {
      get: {
        tags: ["Admin"],
        summary: "List ID verifications",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["pending", "approved", "rejected"], default: "pending" },
          },
        ],
        responses: {
          "200": { description: "{ success, data, count }" },
          "500": { description: "Server error" },
        },
      },
      put: {
        tags: ["Admin"],
        summary: "Approve or reject verification",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/IdVerificationActionBody" },
            },
          },
        },
        responses: {
          "200": { description: "Updated verification" },
          "400": { description: "Invalid action or already processed" },
          "404": { description: "Not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/api/cost-estimate": {
      get: {
        tags: ["Utilities"],
        summary: "Estimate intervention cost (query)",
        parameters: [
          { name: "interventionType", in: "query", required: true, schema: { type: "string" } },
          { name: "area", in: "query", schema: { type: "string" } },
          { name: "barangayId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "{ success: true, data: estimate breakdown }" },
          "400": { description: "Missing interventionType" },
          "500": { description: "Server error" },
        },
      },
      post: {
        tags: ["Utilities"],
        summary: "Estimate with optional customization",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["interventionType"],
                properties: {
                  interventionType: { type: "string" },
                  area: { type: "number" },
                  barangayId: { type: "string" },
                  customization: {
                    type: "object",
                    properties: {
                      additionalServices: {
                        type: "array",
                        items: { type: "object", properties: { cost: { type: "number" } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Same shape as GET success" },
          "400": { description: "Validation error" },
          "500": { description: "Server error" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "sb-access-token",
        description:
          "Supabase session cookies set by SSR (names may include project ref). Use “Try it out” only from the same browser session.",
      },
      bearerCron: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "CRON_SECRET",
        description: "Authorization: Bearer <CRON_SECRET> (see server env)",
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: "object",
        properties: {
          ok: { type: "boolean", enum: [false] },
          error: { type: "string" },
          code: { type: "string" },
        },
      },
      BarangayCreateBody: {
        type: "object",
        required: ["barangayID", "cityID", "barangayName"],
        properties: {
          barangayID: { type: "string" },
          cityID: { type: "string" },
          barangayName: { type: "string" },
          population: { type: "number" },
          area: { type: "number" },
          boundary: {},
          coordinates: {},
        },
      },
      ProfilePatchBody: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          phone: { type: "string", nullable: true },
          address: { type: "string", nullable: true },
          bio: { type: "string", nullable: true },
          businessName: { type: "string", nullable: true },
          portfolioLinks: { type: "string", nullable: true },
          avatarUrl: { type: "string", nullable: true },
          avatarStoragePath: { type: "string", nullable: true },
          idDocumentPath: { type: "string", nullable: true },
          idDocumentFileName: { type: "string", nullable: true },
        },
      },
      SignupBody: {
        type: "object",
        required: ["username", "email", "password"],
        properties: {
          username: { type: "string" },
          email: { type: "string" },
          password: { type: "string" },
          role: { type: "string", enum: ["RESIDENT", "CITY_PLANNER", "ADMIN"] },
          department: { type: "string" },
          city: { type: "string" },
          idNumber: { type: "string" },
          idType: { type: "string" },
          documentPath: { type: "string" },
        },
      },
      IdVerificationActionBody: {
        type: "object",
        required: ["verificationID", "action", "adminUserID"],
        properties: {
          verificationID: { type: "string" },
          action: { type: "string", enum: ["approve", "reject"] },
          adminUserID: { type: "string" },
          rejectionReason: { type: "string" },
        },
      },
    },
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;
