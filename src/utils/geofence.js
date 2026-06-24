export const DEFAULT_OFFICE_LOCATION = {
  lat: Number(import.meta.env.VITE_OFFICE_LAT || 25.5788),
  lng: Number(import.meta.env.VITE_OFFICE_LNG || 91.8933),
  radiusMeters: Number(import.meta.env.VITE_OFFICE_RADIUS_METERS || 100),
}

export const OFFICE_LOCATION = DEFAULT_OFFICE_LOCATION

export const SETTINGS_COLLECTION = 'settings'
export const OFFICE_LOCATION_DOC_ID = 'officeLocation'

export const normalizeOfficeLocation = (data = {}) => ({
  lat: Number(data.lat ?? DEFAULT_OFFICE_LOCATION.lat),
  lng: Number(data.lng ?? DEFAULT_OFFICE_LOCATION.lng),
  radiusMeters: Number(data.radiusMeters ?? DEFAULT_OFFICE_LOCATION.radiusMeters),
  address: data.address || '',
  updatedAt: data.updatedAt || null,
})

const toRadians = (degree) => degree * (Math.PI / 180)

// Haversine formula calculates the real-world distance between two GPS points.
export const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const earthRadiusMeters = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMeters * c
}

export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS is not supported in this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      () => reject(new Error('Please allow location permission to continue.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })

export const isInsideOfficeRadius = (lat, lng, officeLocation = DEFAULT_OFFICE_LOCATION) => {
  const office = normalizeOfficeLocation(officeLocation)
  const distance = calculateDistanceMeters(lat, lng, office.lat, office.lng)

  return {
    allowed: distance <= office.radiusMeters,
    distance,
  }
}
