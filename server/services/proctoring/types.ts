export interface ProctorViolation {
  type: 'camera_disabled' | 'fullscreen_exit' | 'tab_switch' | 'window_blur';
  timestamp: Date;
  sessionId: number;
  severity: 'warning' | 'critical';
  description: string;
}

export interface ProctorSession {
  sessionId: number;
  userId: number;
  startTime: Date;
  violations: ProctorViolation[];
  isActive: boolean;
  cameraEnabled: boolean;
  fullscreenActive: boolean;
}

export interface ProctorConfig {
  enableCameraMonitoring: boolean;
  requireFullscreen: boolean;
  maxViolations: number;
  autoNullifyOnViolation: boolean;
}