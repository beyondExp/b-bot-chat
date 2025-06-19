import { isLocallyAuthenticated, getAuthToken } from "./api"

export interface Thread {
  thread_id: string
  created_at: string
  updated_at: string
  metadata: {
    [key: string]: any
  }
  status: string
  config?: {
    configurable?: {
      agent_id?: string
      user_id?: string
    }
  }
}

export interface ThreadWithMessages extends Thread {
  values?: {
    messages?: any[]
  }
}

export class ThreadService {
  private baseUrl: string
  private getAuthToken: (() => Promise<string | null>) | null
  
  constructor(getAuthToken?: () => Promise<string | null>) {
    this.baseUrl = '/api/proxy'
    this.getAuthToken = getAuthToken || null
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Try to get auth token
    try {
      let token: string | null = null
      
      if (this.getAuthToken) {
        token = await this.getAuthToken()
      } else if (isLocallyAuthenticated()) {
        token = getAuthToken()
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    } catch (error) {
      console.error('Failed to get auth token:', error)
    }

    return headers
  }

  async getThreads(userId?: string, assistantId?: string): Promise<Thread[]> {
    try {
      const headers = await this.getHeaders()
      
      // Try multiple endpoint approaches since search is not working
      const endpoints = [
        // Try the basic threads endpoint with query params
        `${this.baseUrl}/threads`,
        // Try the search endpoint as a fallback
        `${this.baseUrl}/threads/search`
      ]
      
      for (const url of endpoints) {
        console.log('[ThreadService] Trying endpoint:', url)
        
        try {
          let response
          
          if (url.includes('/search')) {
            // Search endpoint - POST with body
            const searchBody: any = {
              limit: 100,
              offset: 0
            }

            // Don't add metadata.owner - let server-side auth handle user filtering
            // The Authorization token already identifies the user

            response = await fetch(url, {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify(searchBody)
            })
          } else {
            // Basic threads endpoint - GET with minimal query params
            // Don't add metadata.owner - let server-side auth handle user filtering
            const urlWithParams = new URL(url, window.location.origin)
            urlWithParams.searchParams.set('limit', '100')

            response = await fetch(urlWithParams.toString(), {
              method: 'GET',
              headers,
              credentials: 'include'
            })
          }

          console.log('[ThreadService] Response status:', response.status)

          if (response.ok) {
            const data = await response.json()
            console.log('[ThreadService] Threads response:', data)
            
            // Check if the response contains an error even with 200 status
            if (data && typeof data === 'object' && data.detail && 
                (data.detail.includes('Method Not Allowed') || data.detail.includes('Not Found'))) {
              console.warn('[ThreadService] Server returned error in success response:', data.detail)
              continue // Try next endpoint
            }
            
            // Don't filter by userId here either - the server already did it
            return this.processThreadsResponse(data, undefined)
          } else {
            console.warn('[ThreadService] Endpoint failed:', url, response.status, response.statusText)
            continue // Try next endpoint
          }
        } catch (endpointError) {
          console.warn('[ThreadService] Endpoint error:', url, endpointError)
          continue // Try next endpoint
        }
      }
      
      // If all endpoints failed, return empty array
      console.warn('[ThreadService] All endpoints failed, returning empty array')
      return []
      
    } catch (error) {
      console.error('[ThreadService] Error fetching threads:', error)
      return []
    }
  }

  private processThreadsResponse(data: any, userId?: string): Thread[] {
    // Handle different response formats
    let threads = []
    if (Array.isArray(data)) {
      threads = data
    } else if (data.threads && Array.isArray(data.threads)) {
      threads = data.threads
    } else if (data.data && Array.isArray(data.data)) {
      threads = data.data
    } else {
      console.warn('[ThreadService] Unexpected response format:', data)
      return []
    }
    
    console.log('[ThreadService] Processing threads:', threads.length, 'threads found')
    
    // If userId is provided, filter by user (check multiple possible locations)
    if (userId) {
      const originalCount = threads.length
      threads = threads.filter((thread: any) => {
        const matchesConfigUser = thread.config?.configurable?.user_id === userId
        const matchesMetadataUser = thread.metadata?.user_id === userId
        const matchesOwner = thread.metadata?.owner === userId
        
        return matchesConfigUser || matchesMetadataUser || matchesOwner
      })
      console.log('[ThreadService] Filtered threads by user:', userId, 'from', originalCount, 'to', threads.length)
    }

    return threads
  }

  async getThread(threadId: string): Promise<ThreadWithMessages | null> {
    try {
      const headers = await this.getHeaders()
      const url = `${this.baseUrl}/threads/${threadId}/state`
      
      console.log('[ThreadService] Fetching thread:', url)
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include', // Include cookies
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch thread: ${response.statusText}`)
      }

      const thread = await response.json()
      console.log('[ThreadService] Thread response:', thread)
      
      return thread
    } catch (error) {
      console.error('[ThreadService] Error fetching thread:', error)
      return null
    }
  }

  async deleteThread(threadId: string): Promise<boolean> {
    try {
      const headers = await this.getHeaders()
      const url = `${this.baseUrl}/threads/${threadId}`
      
      console.log('[ThreadService] Deleting thread:', url)
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        credentials: 'include', // Include cookies
      })

      return response.ok
    } catch (error) {
      console.error('[ThreadService] Error deleting thread:', error)
      return false
    }
  }

  async createThread(config?: any): Promise<Thread | null> {
    try {
      const headers = await this.getHeaders()
      const url = `${this.baseUrl}/threads`
      
      const body: any = {}
      if (config) {
        body.config = config
      }
      
      console.log('[ThreadService] Creating thread with config:', config)
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[ThreadService] Create thread failed:', response.status, response.statusText, errorText)
        throw new Error(`Failed to create thread: ${response.statusText}`)
      }

      const thread = await response.json()
      console.log('[ThreadService] Created thread:', thread)
      
      return thread
    } catch (error) {
      console.error('[ThreadService] Error creating thread:', error)
      return null
    }
  }
} 