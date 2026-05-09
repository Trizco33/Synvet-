// Provider abstraction: every channel implementation (mock, Evolution API,
// Z-API, Meta WhatsApp Cloud, SMTP, Twilio SMS, push, …) honours this shape.
// Routes and the scheduler only ever talk to this interface.

export interface SendMessageInput {
  clinicId: string;
  channelId: string;
  externalId?: string | null; // provider-side instance/session id
  toAddress: string;
  body: string;
}

export interface SendMessageResult {
  providerMessageId: string;
  status: "sent" | "delivered" | "failed";
  errorMessage?: string;
}

export interface ConnectInput {
  id: string;
  clinicId: string;
  externalId?: string | null;
}

export interface ConnectResult {
  qrString: string | null;
  expiresAt: Date | null;
  status: "connecting" | "connected";
  message?: string;
}

export interface ChannelStatus {
  status: "disconnected" | "connecting" | "connected" | "error";
  phoneNumber?: string | null;
  lastError?: string | null;
}

export interface CommsProvider {
  name: string;
  send(input: SendMessageInput): Promise<SendMessageResult>;
  connect(input: ConnectInput): Promise<ConnectResult>;
  disconnect(input: { id: string; externalId?: string | null }): Promise<void>;
  refreshStatus(input: { id: string; externalId?: string | null }): Promise<ChannelStatus>;
}
