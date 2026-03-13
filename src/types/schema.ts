/**
 * TypeScript types matching Prisma schema models
 * Auto-generated interfaces for database entities
 */

// ============================================================================
// ACCOUNT-RELATED TYPES
// ============================================================================

export enum UserRole {
  ADMIN = "ADMIN",
  CITY_PLANNER = "CITY_PLANNER",
  RESIDENT = "RESIDENT",
}

export enum UserStatus {
  REGISTERED = "REGISTERED",
  ACTIVE = "ACTIVE",
  LOGGED_IN = "LOGGED_IN",
  SUSPENDED = "SUSPENDED",
  DELETED = "DELETED",
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  loginID?: string | null;
  loginDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Administrator {
  id: string;
  adminID: string;
  userID: string;
  managedUsers: string[];
  managedDatasets: string[];
  createdAt: Date;
  updatedAt: Date;
  user?: User;
}

export interface CityPlanner {
  id: string;
  plannerID: string;
  userID: string;
  department?: string | null;
  city?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
  idVerification?: IDVerification;
}

export interface IDVerification {
  id: string;
  verificationID: string;
  plannerID: string;
  idNumber: string;
  idType: string;
  documentPath?: string | null;
  documentFileName?: string | null;
  status: string; // pending, approved, rejected
  verifiedBy?: string | null;
  verificationDate?: Date | null;
  rejectionReason?: string | null;
  submittedAt: Date;
  updatedAt: Date;
  planner?: CityPlanner;
}

export interface Resident {
  id: string;
  residentID: string;
  userID: string;
  address?: string | null;
  city?: string | null;
  barangay?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
}

// ============================================================================
// DATA-RELATED TYPES
// ============================================================================

export interface City {
  id: string;
  cityID: string;
  cityName: string;
  province: string;
  population?: number | null;
  area?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CityMetrics {
  id: string;
  cityID: string;
  averageGI?: number | null;
  populationDensity?: number | null;
  averageTemperature?: number | null;
  averageAQI?: number | null;
  lastUpdated: Date;
}

export interface Barangay {
  id: string;
  barangayID: string;
  cityID: string;
  barangayName: string;
  population?: number | null;
  area?: number | null;
  populationDensity?: number | null;
  boundary?: Record<string, any> | null;
  coordinates?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BarangayMetrics {
  id: string;
  barangayID: string;
  NDVI?: number | null;
  LST?: number | null;
  treeCanopy?: number | null;
  greenArea?: number | null;
  airQuality?: number | null;
  povertyRate?: number | null;
  literacy?: number | null;
  healthAccess?: number | null;
  lastUpdated: Date;
}

export interface Point {
  id: string;
  pointID: string;
  barangayID: string;
  pointName: string;
  infrastructure?: string | null;
  coordinates: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PointMetrics {
  id: string;
  pointID: string;
  NDVI?: number | null;
  LST?: number | null;
  GI?: number | null;
  lastUpdated: Date;
}

export interface GreenerIndex {
  id: string;
  giID: string;
  barangayID: string;
  GI1_Quantity: number;
  GI2_Equity: number;
  GI3_Resilience: number;
  GI4_Connectivity: number;
  giValue: number;
  giLevel: string;
  quantityScore?: number | null;
  equityScore?: number | null;
  resilienceScore?: number | null;
  connectivityScore?: number | null;
  environmentalScore?: number | null;
  accessibilityScore?: number | null;
  weights: Record<string, number>;
  computeStatus: string;
  lastUpdated: Date;
}

export interface GreeningRecommendation {
  id: string;
  recommendationID: string;
  areaID?: string | null;
  cityID?: string | null;
  barangayID?: string | null;
  pointID?: string | null;
  source: string;
  name: string;
  description: string;
  interventionType: string;
  relevancy: number;
  efficiency?: number | null;
  equipmentNeeded?: string | null;
  cost?: number | null;
  costUnit?: string | null;
  equity?: number | null;
  priority: string;
  status: string;
  hasBudget: boolean;
  implementationOptions?: Record<string, any> | null;
  monitoringMetrics?: Record<string, any> | null;
  approvedBy?: string | null;
  approvalDate?: Date | null;
  rejectionReason?: string | null;
  recordedOutcome?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricData {
  id: string;
  metricID: string;
  metricType: string;
  metricValue: number;
  metricUnit: string;
  source: string;
  dataSet?: string | null;
  dateRecorded: Date;
  validFrom?: Date | null;
  validTo?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MapLayer {
  id: string;
  mapID: string;
  mapType: string;
  mapName: string;
  mapLink?: string | null;
  toggleVisibility: boolean;
  color?: string | null;
  opacity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dataset {
  id: string;
  dataSetID: string;
  dataSetName: string;
  dataType: string;
  lastUpdated: Date;
  dataSource: string;
  recordCount?: number | null;
  validationStatus: string;
  createdAt: Date;
}

export interface GeoPhoto {
  id: string;
  photoID: string;
  residentID: string;
  imagePath: string;
  imageFile: string;
  location: Record<string, any>;
  barangayID?: string | null;
  description?: string | null;
  tags: string[];
  uploadDate: Date;
  uploader: string;
  createdAt: Date;
}

export interface HazardExposure {
  id: string;
  barangayID: string;
  hazardType: string;
  exposureLevel?: number | null;
  exposureScore?: number | null;
  affectedPopulation?: number | null;
  lastUpdated: Date;
}

// ============================================================================
// LOGGING & AUDIT TYPES
// ============================================================================

export interface SystemLog {
  id: string;
  userID?: string | null;
  action: string;
  resource?: string | null;
  resourceID?: string | null;
  status: string;
  details?: Record<string, any> | null;
  timestamp: Date;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}
