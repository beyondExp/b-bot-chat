/**
 * Simple Voice Activity Detection using Web Audio API
 * No external dependencies - pure browser APIs
 */

export interface VADOptions {
  onSpeechStart: () => void
  onSpeechEnd: (audioData: Float32Array) => void
  onVADMisfire?: () => void
  
  // Thresholds
  energyThreshold?: number // 0-1, default 0.01
  silenceDuration?: number // ms, default 1500
  minSpeechDuration?: number // ms, default 300
  
  // Audio settings
  sampleRate?: number // default 16000
}

export class SimpleVAD {
  private audioContext: AudioContext
  private mediaStream: MediaStream
  private analyser: AnalyserNode
  private scriptProcessor: ScriptProcessorNode | null = null
  private audioWorkletNode: AudioWorkletNode | null = null
  
  private isSpeaking: boolean = false
  private speechStartTime: number = 0
  private lastSpeechTime: number = 0
  private audioChunks: Float32Array[] = []
  
  private options: Required<VADOptions>
  private checkInterval: NodeJS.Timeout | null = null
  
  constructor(mediaStream: MediaStream, options: VADOptions) {
    this.mediaStream = mediaStream
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: options.sampleRate || 16000
    })
    
    this.options = {
      onSpeechStart: options.onSpeechStart,
      onSpeechEnd: options.onSpeechEnd,
      onVADMisfire: options.onVADMisfire || (() => {}),
      energyThreshold: options.energyThreshold || 0.01,
      silenceDuration: options.silenceDuration || 1500,
      minSpeechDuration: options.minSpeechDuration || 300,
      sampleRate: options.sampleRate || 16000
    }
    
    // Create analyser
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.8
    
    // Connect media stream to analyser
    const source = this.audioContext.createMediaStreamSource(mediaStream)
    source.connect(this.analyser)
    
    // Use ScriptProcessor for audio capture (AudioWorklet would be better but more complex)
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.analyser.connect(this.scriptProcessor)
    this.scriptProcessor.connect(this.audioContext.destination)
    
    this.scriptProcessor.onaudioprocess = (event) => {
      this.processAudio(event.inputBuffer)
    }
  }
  
  private processAudio(buffer: AudioBuffer) {
    const channelData = buffer.getChannelData(0)
    const energy = this.calculateEnergy(channelData)
    
    const now = Date.now()
    
    if (energy > this.options.energyThreshold) {
      // Speech detected
      if (!this.isSpeaking) {
        this.isSpeaking = true
        this.speechStartTime = now
        this.audioChunks = []
        this.options.onSpeechStart()
        console.log('[SimpleVAD] Speech started, energy:', energy)
      }
      
      this.lastSpeechTime = now
      
      // Store audio data
      this.audioChunks.push(new Float32Array(channelData))
    } else {
      // Silence detected
      if (this.isSpeaking) {
        const silenceDuration = now - this.lastSpeechTime
        
        if (silenceDuration >= this.options.silenceDuration) {
          // End of speech
          const speechDuration = now - this.speechStartTime
          
          if (speechDuration >= this.options.minSpeechDuration) {
            // Valid speech segment
            console.log('[SimpleVAD] Speech ended, duration:', speechDuration, 'ms')
            
            // Concatenate all audio chunks
            const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
            const combined = new Float32Array(totalLength)
            let offset = 0
            
            for (const chunk of this.audioChunks) {
              combined.set(chunk, offset)
              offset += chunk.length
            }
            
            this.options.onSpeechEnd(combined)
          } else {
            // Too short, likely a misfire
            console.log('[SimpleVAD] Speech too short, misfire')
            this.options.onVADMisfire()
          }
          
          this.isSpeaking = false
          this.audioChunks = []
        }
      }
    }
  }
  
  private calculateEnergy(samples: Float32Array): number {
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i]
    }
    return Math.sqrt(sum / samples.length)
  }
  
  start() {
    console.log('[SimpleVAD] Starting/Resuming')
    // Reconnect the scriptProcessor if it was disconnected
    if (this.scriptProcessor && this.analyser) {
      try {
        // Reconnect: analyser -> scriptProcessor -> destination
        this.analyser.connect(this.scriptProcessor)
        this.scriptProcessor.connect(this.audioContext.destination)
        console.log('[SimpleVAD] Reconnected and listening')
      } catch (e) {
        // May already be connected, that's fine
        console.log('[SimpleVAD] Already connected or error:', e)
      }
    }
    // Reset state for fresh detection
    this.isSpeaking = false
    this.audioChunks = []
  }
  
  pause() {
    console.log('[SimpleVAD] Paused')
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect()
      } catch (e) {
        console.log('[SimpleVAD] Already disconnected')
      }
    }
    // Reset speaking state
    this.isSpeaking = false
    this.audioChunks = []
  }
  
  destroy() {
    console.log('[SimpleVAD] Destroyed')
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect()
      this.scriptProcessor = null
    }
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect()
      this.audioWorkletNode = null
    }
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close()
    }
  }
}

