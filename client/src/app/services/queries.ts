import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './apiClient';

export const mapFacility = (f: any) => {
  if (!f) return f;

  // Default user location (Nakasero, Kampala)
  const userLat = 0.3190;
  const userLng = 32.5850;

  const facLat = f.latitude !== undefined ? Number(f.latitude) : 0;
  const facLng = f.longitude !== undefined ? Number(f.longitude) : 0;

  let calculatedDistance = 0.5;
  if (facLat && facLng) {
    // Haversine formula in JS
    const R = 6371; // earth radius in km
    const dLat = (facLat - userLat) * Math.PI / 180;
    const dLng = (facLng - userLng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLat * Math.PI / 180) * Math.cos(facLat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    calculatedDistance = R * c;
  }

  const distanceKm = f.distance_km !== undefined 
    ? Number(f.distance_km) 
    : (f.distanceKm !== undefined ? Number(f.distanceKm) : Math.round(calculatedDistance * 10) / 10);

  const etaMin = f.eta_min !== undefined 
    ? Number(f.eta_min) 
    : (f.etaMin !== undefined ? Number(f.etaMin) : Math.max(3, Math.round((distanceKm / 25) * 60)));

  return {
    ...f,
    totalSpaces: f.total_spaces !== undefined ? Number(f.total_spaces) : (f.totalSpaces ?? 0),
    availableSpaces: f.available_spaces !== undefined ? Number(f.available_spaces) : (f.availableSpaces ?? 0),
    pricePerHour: f.price_per_hour !== undefined ? Number(f.price_per_hour) : (f.pricePerHour ?? 0),
    rating: f.rating !== undefined ? Number(f.rating) : (f.rating ?? 0),
    reviewCount: f.review_count !== undefined ? Number(f.review_count) : (f.reviewCount ?? 0),
    image: f.image_url !== undefined ? f.image_url : (f.image ?? ''),
    hasSecurity: f.has_security !== undefined ? Boolean(f.has_security) : (f.hasSecurity ?? false),
    distanceKm,
    etaMin,
  };
};

// --- FACILITIES ---
export const useFacilities = () => {
  return useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const res = await apiClient.get('/facilities');
      const data = res.data.data.facilities || [];
      return data.map(mapFacility);
    },
  });
};

export const useNearbyFacilities = (lat: number | null, lng: number | null) => {
  return useQuery({
    queryKey: ['facilities', 'nearby', lat, lng],
    queryFn: async () => {
      if (lat === null || lng === null) return [];
      const res = await apiClient.get('/facilities/nearby', {
        params: { lat, lng },
      });
      const data = res.data.data.facilities || [];
      return data.map(mapFacility);
    },
    enabled: lat !== null && lng !== null,
  });
};

export const useSearchFacilities = (q: string) => {
  return useQuery({
    queryKey: ['facilities', 'search', q],
    queryFn: async () => {
      const res = await apiClient.get('/facilities/search', {
        params: { q },
      });
      const data = res.data.data.facilities || [];
      return data.map(mapFacility);
    },
    enabled: q.length > 0,
  });
};

export const useFacilityAvailability = (id: string) => {
  return useQuery({
    queryKey: ['facilities', id, 'availability'],
    queryFn: async () => {
      const res = await apiClient.get(`/facilities/${id}/availability`);
      return res.data.data;
    },
  });
};

export const useCreateFacility = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await apiClient.post('/facilities', data);
      return mapFacility(res.data.data.facility);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
};

export const useUpdateFacility = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      const res = await apiClient.put(`/facilities/${id}`, data);
      return mapFacility(res.data.data.facility);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['operator', 'facilities'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'facilities'] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['facilities', data.id, 'availability'] });
      }
    },
  });
};

// --- VEHICLES ---
export const useVehicles = () => {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await apiClient.get('/vehicles');
      return res.data.data.vehicles;
    },
  });
};

export const useCreateVehicle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await apiClient.post('/vehicles', data);
      return res.data.data.vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
};

export const useUpdateVehicle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      const res = await apiClient.put(`/vehicles/${id}`, data);
      return res.data.data.vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
};

export const useDeleteVehicle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/vehicles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
};

// --- RESERVATIONS ---
export const useReservations = () => {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: async () => {
      const res = await apiClient.get('/reservations');
      return res.data.data.reservations;
    },
  });
};

export const useCreateReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await apiClient.post('/reservations', data);
      return res.data.data.reservation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      if (data?.facilityId) {
        queryClient.invalidateQueries({ queryKey: ['facilities', data.facilityId, 'availability'] });
      }
    },
  });
};

export const useCancelReservation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reservations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
};

// --- SESSIONS ---
export const useSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await apiClient.get('/sessions');
      return res.data.data.sessions;
    },
  });
};

export const useCheckoutSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.put(`/sessions/${id}/checkout`);
      return res.data.data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
};

// --- SCANNER ---
export const useValidateQR = () => {
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await apiClient.post('/scanner/validate', { token });
      return res.data.data.reservation;
    },
  });
};

export const useCheckInDriver = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) => {
      const res = await apiClient.post('/scanner/checkin', { reservationId });
      return res.data.data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });
};

// --- PAYMENTS & RECEIPTS ---
export const usePayments = () => {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await apiClient.get('/payments/history');
      return res.data.data.payments;
    },
  });
};

export const useInitiatePayment = () => {
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await apiClient.post('/payments/initiate', data);
      return res.data.data;
    },
  });
};

export const useConfirmPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { transactionReference: string }) => {
      const res = await apiClient.post('/payments/confirm', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
};

export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await apiClient.post('/support/tickets', data);
      return res.data.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
  });
};

export const useReceipt = (id: string) => {
  return useQuery({
    queryKey: ['receipts', id],
    queryFn: async () => {
      const res = await apiClient.get(`/receipts/${id}`);
      return res.data.data.receipt;
    },
    enabled: !!id,
  });
};

// --- NOTIFICATIONS ---
export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get('/notifications');
      return res.data.data.notifications;
    },
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.put(`/notifications/${id}/read`);
      return res.data.data.notification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// --- OPERATOR ENDPOINTS ---
export const useOperatorDashboard = () => {
  return useQuery({
    queryKey: ['operator', 'dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/operator/dashboard');
      return res.data.data;
    },
  });
};

export const useOperatorFacilities = () => {
  return useQuery({
    queryKey: ['operator', 'facilities'],
    queryFn: async () => {
      const res = await apiClient.get('/operator/facilities');
      const data = res.data.data.facilities || [];
      return data.map(mapFacility);
    },
  });
};

export const useOperatorReports = () => {
  return useQuery({
    queryKey: ['operator', 'reports'],
    queryFn: async () => {
      const res = await apiClient.get('/operator/reports');
      return res.data.data.reports;
    },
  });
};

// --- ADMIN ENDPOINTS ---
export const useAdminUsers = () => {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users');
      return res.data.data;
    },
  });
};

export const useToggleUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.put(`/admin/users/${id}/status`, { status });
      return res.data.data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
};

export const useAdminFacilities = () => {
  return useQuery({
    queryKey: ['admin', 'facilities'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/facilities');
      const data = res.data.data || {};
      return {
        pending: (data.pending || []).map(mapFacility),
        active: (data.active || []).map(mapFacility),
      };
    },
  });
};

export const useApproveFacility = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) => {
      const res = await apiClient.put(`/admin/facilities/${id}/approve`, { decision });
      return mapFacility(res.data.data.facility);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'facilities'] });
    },
  });
};

export const useSystemMetrics = () => {
  return useQuery({
    queryKey: ['admin', 'system'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/system');
      return res.data.data;
    },
  });
};

export const useAuditLogs = () => {
  return useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/audit');
      return res.data.data.auditLogs;
    },
  });
};

// --- PASSWORD RESET ---
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await apiClient.post('/auth/forgot-password', { email });
      return res.data;
    },
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await apiClient.post('/auth/reset-password', data);
      return res.data;
    },
  });
};

export const useFacilityReviews = (facilityId: string) => {
  return useQuery({
    queryKey: ['facilities', facilityId, 'reviews'],
    queryFn: async () => {
      const res = await apiClient.get(`/facilities/${facilityId}/reviews`);
      return res.data.data.reviews || [];
    },
    enabled: !!facilityId,
  });
};

export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ facilityId, rating, comment }: { facilityId: string; rating: number; comment?: string }) => {
      const res = await apiClient.post(`/facilities/${facilityId}/reviews`, { rating, comment });
      return res.data.data.review;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['facilities', variables.facilityId] });
      queryClient.invalidateQueries({ queryKey: ['facilities', variables.facilityId, 'reviews'] });
    },
  });
};
