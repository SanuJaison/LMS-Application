import {
  User,
  Zone,
  District,
  DashboardStats,
} from '../types';

/**
 * Dedicated API endpoints for specific tabs.
 * All others map to /api/admin/[tab].
 */
const DEDICATED_RESOURCE_TABS: Record<string, string> = {
  designations: '/api/designations',
  districts: '/api/districts',
  courses: '/api/courses',
  taskTemplates: '/api/task-templates',
  'task-templates': '/api/task-templates',
  employeeTasks: '/api/employee-tasks',
  'employee-tasks': '/api/employee-tasks',
  leads: '/api/leads',
  followups: '/api/followups',
};

function resourceEndpoint(tab: string): string {
  return DEDICATED_RESOURCE_TABS[tab] || `/api/admin/${tab}`;
}

/**
 * Get JWT token from local storage
 */
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
}

/**
 * Helper to build headers with Authorization JWT bearer token
 */
export function authHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Authentication Service (MongoDB backed with JWT)
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; token?: string; message?: string }> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token && typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.token);
      }
      return data;
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, message: err.message || 'Invalid credentials' };
  } catch (e: any) {
    console.error('Login error:', e);
    return { success: false, message: e.message || 'Connection failed' };
  }
}

/**
 * Load Kerala Zones strictly from MongoDB Atlas
 */
export async function fetchZones(): Promise<Zone[]> {
  try {
    const res = await fetch('/api/zones', {
      headers: authHeaders(),
    });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      if (list.length > 0) {
        return list.map((z: any) => ({
          id: (z.id || z._id || z.name || '').toString(),
          name: z.name,
          description: z.description || '',
          createdAt: z.createdAt,
        }));
      }
    }
  } catch (e) {
    console.error('Failed to fetch zones:', e);
  }
  return [];
}

/**
 * Load Kerala Districts strictly from MongoDB Atlas
 */
export async function fetchDistricts(): Promise<District[]> {
  try {
    const res = await fetch('/api/districts', {
      headers: authHeaders(),
    });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      if (list.length > 0) {
        return list.map((d: any) => ({
          id: (d.id || d._id || '').toString(),
          name: d.name,
          zoneId: d.zoneId || '',
          zoneName: d.zoneName || d.zone || '',
        }));
      }
    }
  } catch (e) {
    console.error('Failed to fetch districts:', e);
  }
  return [];
}

/**
 * Load Live Dashboard Analytics from MongoDB Atlas (Real, dynamic calculations)
 */
export async function fetchDashboardStats(zone?: string, district?: string): Promise<DashboardStats> {
  try {
    const params = new URLSearchParams();
    if (zone && zone !== 'All Zones') params.append('zone', zone);
    if (district && district !== 'All Districts') params.append('district', district);
    const q = params.toString();
    const res = await fetch(`/api/admin/stats${q ? `?${q}` : ''}`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) return json.data;
    }
  } catch (e) {
    console.error('Failed to fetch dashboard stats:', e);
  }

  return {
    totalLeads: 0,
    newLeadsToday: 0,
    activeFieldForce: '0/0 Active',
    totalEmployees: 0,
    leadsByStatus: { labels: [], data: [], colors: [] },
    leadGenerationTrend: { months: [], data: [] },
    leadsByDistrict: { labels: [], data: [] },
    liveAttendance: [],
  };
}

/**
 * Generic Resource Data Fetcher strictly from MongoDB Atlas
 */
export async function fetchResourceList(tab: string): Promise<any[]> {
  try {
    const endpoint = resourceEndpoint(tab);
    const res = await fetch(endpoint, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) return json;
      if (json.data && Array.isArray(json.data)) return json.data;
    } else {
      console.warn(`Resource fetch for ${tab} returned ${res.status}`);
    }
  } catch (e) {
    console.error(`Failed to fetch resource list for ${tab}:`, e);
  }
  return [];
}

/**
 * Create Resource item in MongoDB Atlas
 */
export async function createResourceItem(tab: string, item: any): Promise<any> {
  try {
    const endpoint = tab === 'leads' ? '/api/leads/create' : resourceEndpoint(tab);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(item),
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create item in ${tab}`);
  } catch (e) {
    console.error(`Backend createResourceItem for ${tab} failed:`, e);
    throw e;
  }
}

/**
 * Update an existing Resource item in MongoDB Atlas
 */
export async function updateResourceItem(tab: string, item: any): Promise<any> {
  try {
    const endpoint = resourceEndpoint(tab);
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(item),
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update item in ${tab}`);
  } catch (e) {
    console.error(`Backend updateResourceItem for ${tab} failed:`, e);
    throw e;
  }
}

/**
 * Delete a Resource item or multiple items in MongoDB Atlas
 */
export async function deleteResourceItem(tab: string, ids: string | string[]): Promise<any> {
  const idList = Array.isArray(ids) ? ids : [ids];
  try {
    const endpoint = resourceEndpoint(tab);
    const isSingle = idList.length === 1;
    const url = isSingle ? `${endpoint}?id=${idList[0]}` : endpoint;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: isSingle ? undefined : JSON.stringify({ ids: idList }),
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to delete item(s) in ${tab}`);
  } catch (e) {
    console.error(`Backend deleteResourceItem for ${tab} failed:`, e);
    throw e;
  }
}

/**
 * Trigger automated task generation for all active templates in MongoDB Atlas
 */
export async function generateTasksNow(): Promise<{ success: boolean; generatedCount?: number; message?: string }> {
  try {
    const res = await fetch('/api/task-templates/generate', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    return await res.json();
  } catch (error) {
    console.error('Failed to trigger generateTasksNow:', error);
    return { success: false, message: 'Failed to generate tasks' };
  }
}
