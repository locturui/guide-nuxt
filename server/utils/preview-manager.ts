type PreviewData = {
  booking_id: string;
  agency_id: string;
  guest_previews: any[];
  general_errors: string[];
};

type Session = {
  data: PreviewData;
  created_at: Date;
  expires_at: Date;
};

class PreviewManager {
  private sessions: Map<string, Session> = new Map();
  private ttlMinutes = 30;

  createPreviewSession(previewData: PreviewData): string {
    const sessionId = crypto.randomUUID();

    const session: Session = {
      data: previewData,
      created_at: new Date(),
      expires_at: new Date(Date.now() + this.ttlMinutes * 60 * 1000),
    };

    this.sessions.set(sessionId, session);
    this.cleanupExpired();

    return sessionId;
  }

  getPreviewSession(sessionId: string): PreviewData | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    if (new Date() > session.expires_at) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session.data;
  }

  deletePreviewSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  private cleanupExpired() {
    const now = new Date();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (now > session.expires_at) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach(sessionId => this.sessions.delete(sessionId));
  }
}

export const previewManager = new PreviewManager();
