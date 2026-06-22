const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // auth
  usersExist: () => request('/auth/users-exist'),
  register: (username, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // items
  listItems: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
    return request(`/items${qs ? `?${qs}` : ''}`);
  },
  getItem: (id) => request(`/items/${id}`),
  updateItem: (id, patch) => request(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  facets: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
    return request(`/items/facets${qs ? `?${qs}` : ''}`);
  },
  upload: (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      xhr.open('POST', `${BASE}/items/upload`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data?.error || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
      xhr.send(formData);
    });
  },
  comicPages: (id) => request(`/items/${id}/pages`),
  fileUrl: (id) => `${BASE}/items/${id}/file`,
  coverUrl: (id) => `${BASE}/items/${id}/cover`,
  pageUrl: (id, index) => `${BASE}/items/${id}/page/${index}`,

  uploadCover: (id, file) => {
    const formData = new FormData();
    formData.append('cover', file);
    return request(`/items/${id}/cover`, { method: 'POST', body: formData });
  },
  searchMetadata: (q) => request(`/items/search-metadata?q=${encodeURIComponent(q)}`),

  // progress
  setProgress: (itemId, payload) => request(`/progress/${itemId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  continueReading: () => request('/progress/continue-reading'),
  favorite: (itemId) => request(`/progress/${itemId}/favorite`, { method: 'POST' }),
  unfavorite: (itemId) => request(`/progress/${itemId}/favorite`, { method: 'DELETE' }),
  getAnalytics: () => request('/progress/analytics'),

  // profile & theme
  updateProfile: (patch) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return request('/auth/avatar', { method: 'POST', body: formData });
  },
  avatarUrl: (filename) => `${BASE}/auth/avatar/${filename}`,

  // shelves
  getShelves: () => request('/shelves'),
  createShelf: (name) => request('/shelves', { method: 'POST', body: JSON.stringify({ name }) }),
  renameShelf: (id, name) => request(`/shelves/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteShelf: (id) => request(`/shelves/${id}`, { method: 'DELETE' }),
  addToShelf: (id, item_id) => request(`/shelves/${id}/items`, { method: 'POST', body: JSON.stringify({ item_id }) }),
  removeFromShelf: (id, item_id) => request(`/shelves/${id}/items/${item_id}`, { method: 'DELETE' }),

  // highlights
  getHighlights: (itemId) => request(`/highlights/${itemId}`),
  getRecentHighlights: (limit = 5) => request(`/highlights/recent?limit=${limit}`),
  createHighlight: (payload) => request('/highlights', { method: 'POST', body: JSON.stringify(payload) }),
  updateHighlight: (id, payload) => request(`/highlights/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteHighlight: (id) => request(`/highlights/${id}`, { method: 'DELETE' }),

  // analytics
  getAnalyticsDashboard: () => request('/analytics/dashboard'),

  // annotations
  getAnnotations: (itemId, pageIndex) => request(`/annotations/${itemId}/${pageIndex}`),
  saveAnnotations: (itemId, pageIndex, strokes) => request(`/annotations/${itemId}/${pageIndex}`, { method: 'POST', body: JSON.stringify({ strokes }) }),

  // log reading time
  logReadingTime: (itemId, minutes) => request('/progress/log-time', { method: 'POST', body: JSON.stringify({ itemId, minutes }) }),

  // notion
  syncToNotion: (itemId) => request(`/notion/sync/${itemId}`, { method: 'POST' }),

  // comments
  getComments: (itemId) => request(`/items/${itemId}/comments`),
  addComment: (itemId, comment) => request(`/items/${itemId}/comments`, { method: 'POST', body: JSON.stringify({ comment }) }),

  // toggle shared shelf
  toggleSharedShelf: (shelfId) => request(`/shelves/${shelfId}/toggle-shared`, { method: 'POST' }),
};
