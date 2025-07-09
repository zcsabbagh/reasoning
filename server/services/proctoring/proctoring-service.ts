import { ProctorViolation, ProctorSession, ProctorConfig } from './types';

export class ProctorService {
  private sessions: Map<number, ProctorSession> = new Map();
  private config: ProctorConfig;

  constructor(config: ProctorConfig = {
    enableCameraMonitoring: true,
    requireFullscreen: true,
    maxViolations: 1,
    autoNullifyOnViolation: true
  }) {
    this.config = config;
  }

  // Initialize proctoring session
  initializeSession(sessionId: number, userId: number): ProctorSession {
    const proctorSession: ProctorSession = {
      sessionId,
      userId,
      startTime: new Date(),
      violations: [],
      isActive: true,
      cameraEnabled: false,
      fullscreenActive: false
    };

    this.sessions.set(sessionId, proctorSession);
    return proctorSession;
  }

  // Record a violation
  recordViolation(sessionId: number, violation: Omit<ProctorViolation, 'timestamp'>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const fullViolation: ProctorViolation = {
      ...violation,
      timestamp: new Date()
    };

    session.violations.push(fullViolation);

    // Check if session should be nullified
    if (this.config.autoNullifyOnViolation && violation.severity === 'critical') {
      session.isActive = false;
      return true; // Indicates session should be nullified
    }

    return false;
  }

  // Update session status
  updateSessionStatus(sessionId: number, updates: Partial<Pick<ProctorSession, 'cameraEnabled' | 'fullscreenActive'>>) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    Object.assign(session, updates);
  }

  // Get session status
  getSessionStatus(sessionId: number): ProctorSession | undefined {
    return this.sessions.get(sessionId);
  }

  // Check if session is valid (no critical violations)
  isSessionValid(sessionId: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    return session.isActive && 
           session.violations.filter(v => v.severity === 'critical').length === 0;
  }

  // End proctoring session
  endSession(sessionId: number) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
    }
  }

  // Get violation summary
  getViolationSummary(sessionId: number): { warnings: number; critical: number } {
    const session = this.sessions.get(sessionId);
    if (!session) return { warnings: 0, critical: 0 };

    return {
      warnings: session.violations.filter(v => v.severity === 'warning').length,
      critical: session.violations.filter(v => v.severity === 'critical').length
    };
  }
}

// Export singleton instance
export const proctorService = new ProctorService();