/**
 * API Module - Gọi API backend
 */
const API = {
    /**
     * Gọi API chung
     */
    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : CONFIG.API_BASE_URL + endpoint;
        const token = localStorage.getItem('token');
        const isFormData = options.body instanceof FormData;

        const headers = {
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        };

        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const requestId = `${options.method || 'GET'} ${url}`;
        console.time(`⏱️ API: ${requestId}`);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            console.timeEnd(`⏱️ API: ${requestId}`);
            console.log(`📡 Status: ${response.status} for ${requestId}`);

            // Xử lý token hết hạn
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                showLoginPage();
                throw new Error('Phiên đăng nhập đã hết hạn');
            }

            let data = {};
            if (response.status !== 204) {
                data = await response.json();
            }

            if (!response.ok) {
                throw { status: response.status, data };
            }

            return data;
        } catch (error) {
            console.timeEnd(`⏱️ API: ${requestId}`);
            if (error.status) throw error;
            console.error('API Error:', error);
            throw { status: 0, data: { error: 'Không thể kết nối server' } };
        }
    },

    // GET request
    get(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${endpoint}?${query}` : endpoint;
        return this.request(url);
    },

    // POST request
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data instanceof FormData ? data : JSON.stringify(data),
        });
    },

    // PUT request
    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data instanceof FormData ? data : JSON.stringify(data),
        });
    },

    // PATCH request
    patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: data instanceof FormData ? data : JSON.stringify(data),
        });
    },

    // DELETE request
    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    },
};
