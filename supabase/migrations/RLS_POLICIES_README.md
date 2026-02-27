# Supabase Row Level Security (RLS) Policies

## Overview

This document describes the Row Level Security (RLS) policies implemented for the GreenPoint system. RLS ensures that users can only access data appropriate for their role.

## Roles

### 1. **Admin**
- Full access to all tables
- Can create, read, update, and delete any record
- Can manage users and their roles
- Can view system logs

### 2. **City Planner**
- Access to their assigned city's data
- Can view and create recommendations for their city
- Can manage barangay metrics and metrics within their city
- Can view photos and hazard data for their city
- Cannot access other cities' data

### 3. **Resident**
- Access to their own profile and barangay data
- Can view approved recommendations
- Can upload and manage their own geo-photos
- Can view city-wide metrics and hazard exposure
- Can view barangay-specific data
- Limited to viewing data relevant to their location

## Policy Structure

### User Management Tables

#### User Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ ALL | ✓ ALL | ✓ ALL |
| City Planner | ✓ City residents | ✗ | ✗ | ✗ |
| Resident | ✓ Own profile | ✗ | ✓ Own | ✗ |
| Public | ✗ | ✗ | ✗ | ✗ |

#### Administrator Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| Others | ✗ | ✗ | ✗ | ✗ |

#### CityPlanner Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| CityPlanner | ✓ Own | ✗ | ✗ | ✗ |
| Others | ✗ | ✗ | ✗ | ✗ |

#### Resident Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| CityPlanner | ✓ Their city | ✗ | ✗ | ✗ |
| Resident | ✓ Own | ✗ | ✓ Own | ✗ |
| Public | ✗ | ✗ | ✗ | ✗ |

### Geographic Data Tables

#### City, Barangay, Point Tables
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| City Planner | ✓ ALL | ✗ | ✗ | ✗ |
| Resident | ✓ ALL | ✗ | ✗ | ✗ |
| Public | ✓ ALL | ✗ | ✗ | ✗ |

**Rationale**: Geographic and city data is public knowledge that helps all users understand their area.

### Metrics Tables

#### CityMetrics, BarangayMetrics, PointMetrics, MetricData
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| City Planner | ✓ ALL | ✗ | ✗ | ✗ |
| Resident | ✓ ALL | ✗ | ✗ | ✗ |
| Public | ✓ ALL | ✗ | ✗ | ✗ |

**Rationale**: Metrics (NDVI, LST, AQI, etc.) are environmental data crucial for decision-making.

### GreenerIndex Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| City Planner | ✓ Their city | ✗ | ✗ | ✗ |
| Resident | ✓ ALL | ✗ | ✗ | ✗ |
| Public | ✓ ALL | ✗ | ✗ | ✗ |

**Rationale**: GI values are informational but city planners see only their cities.

### GreeningRecommendation Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| City Planner | ✓ Their city | ✓ | ✓ (theirs) | ✓ (theirs) |
| Resident | ✓ Approved/Implemented, own barangay | ✗ | ✗ | ✗ |
| Public | ✓ Approved/Implemented | ✗ | ✗ | ✗ |

**Rationale**: 
- City planners create and manage recommendations for their city
- Residents see approved/implemented recommendations for action items
- Public only sees approved recommendations

### GeoPhoto Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| City Planner | ✓ Their city | ✗ | ✗ | ✗ |
| Resident | ✓ ALL | ✓ Own | ✓ Own | ✓ Own |
| Public | ✓ ALL | ✗ | ✗ | ✗ |

**Rationale**: 
- Residents contribute photos to their community
- Photos are public to encourage community engagement
- City planners use photos for planning decisions

### HazardExposure Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| City Planner | ✓ Their city | ✗ | ✗ | ✗ |
| Resident | ✓ ALL | ✗ | ✗ | ✗ |
| Public | ✓ ALL | ✗ | ✗ | ✗ |

**Rationale**: Hazard data is critical safety information that should be publicly available.

### SystemLog Table
| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| Admin | ✓ ALL | ✓ | ✓ | ✓ |
| City Planner | ✗ | ✗ | ✗ | ✗ |
| Resident | ✓ Own | ✗ | ✗ | ✗ |
| Public | ✗ | ✗ | ✗ | ✗ |

**Rationale**: Audit logs are security-sensitive; only admins and users can see their own.

## Helper Functions

The following PostgreSQL functions are used to determine user roles and permissions:

```sql
-- Check if user is an admin
is_admin(user_id UUID) -> BOOLEAN

-- Check if user is a city planner
is_city_planner(user_id UUID) -> BOOLEAN

-- Check if user is a resident
is_resident(user_id UUID) -> BOOLEAN

-- Get user's role
get_user_role(user_id UUID) -> TEXT

-- Get city planner's assigned city
get_planner_city(user_id UUID) -> UUID

-- Get resident's barangay
get_resident_barangay(user_id UUID) -> STRING
```

## Policy Logic Examples

### Example 1: City Planner Views Barangays
```sql
-- City planners can view all barangays (not restricted)
-- But at application level, filtered to their city via:
SELECT b.* FROM "Barangay" b
WHERE b."cityID" = (
  SELECT "cityID" FROM "City" WHERE id = (
    SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
  )
)
```

### Example 2: Resident Views Recommendations
```sql
-- Residents see only approved recommendations for their barangay
SELECT r.* FROM "GreeningRecommendation" r
WHERE (r.status = 'approved' OR r.status = 'implemented')
AND r."barangayID" = (
  SELECT id FROM "Barangay" WHERE "barangayName" = (
    SELECT barangay FROM "Resident" WHERE "userID" = auth.uid()
  )
)
```

### Example 3: City Planner Manages Recommendations
```sql
-- City planners can CRUD recommendations in their city
SELECT r.* FROM "GreeningRecommendation" r
WHERE r."cityID" = (SELECT "cityID" FROM "City" WHERE id = (
  SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
))
OR r."barangayID" IN (
  SELECT id FROM "Barangay" WHERE "cityID" = (
    SELECT "cityID" FROM "City" WHERE id = (
      SELECT city FROM "CityPlanner" WHERE "userID" = auth.uid()
    )
  )
)
```

## Security Considerations

1. **Function-Based Authentication**: All role checks use PostgreSQL functions with `SECURITY DEFINER` to prevent privilege escalation.

2. **Row Level Security Enforcement**: `FORCE ROW LEVEL SECURITY` is used to ensure RLS cannot be bypassed.

3. **Audit Logging**: The `log_action()` trigger function automatically logs all user actions for accountability.

4. **Data Isolation**: 
   - City planners cannot access data from other cities
   - Residents cannot access data from other barangays
   - Admins have full access for management and monitoring

5. **Insert/Update Checks**: WHERE and WITH CHECK clauses ensure users can only create/modify data they have permission to access.

## Implementation Notes

- All tables have RLS explicitly enabled with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- DefaultRLS policy is PERMISSIVE (allows access) rather than RESTRICTIVE (denies by default)
- Multiple policies can exist per table for different operations
- Policy names are descriptive (e.g., `admin_manage_users`, `resident_view_own`)

## Testing RLS Policies

To test these policies:

```sql
-- Switch to a specific user
SET LOCAL "request.jwt.claims" = '{"sub":"USER_ID", "role":"USER_ROLE"}';

-- Try selecting data (should respect RLS)
SELECT * FROM "City";
```

## Migration Instructions

1. Ensure your Supabase database is set up with the initial schema migration
2. Run this migration to enable RLS on all tables
3. Test each role's access patterns in Supabase Studio
4. Update your application authentication to properly set `auth.uid()`

## Future Enhancements

- Add time-based access restrictions
- Implement data retention policies
- Add approval workflows with role-based approvals
- Implement sensitive data masking
- Add IP-based access controls
