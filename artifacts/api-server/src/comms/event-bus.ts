import { EventEmitter } from "node:events";

// ---------------------------------------------------------------------------
// Internal domain event bus for the Communications module.
// In V1 this is an in-process EventEmitter — fire-and-forget from route
// handlers. To scale to multi-instance, swap the implementation for a real
// queue (BullMQ / Redis Streams / Temporal) without changing call sites.
// ---------------------------------------------------------------------------

export type CommsEvent =
  | {
      type: "consultation.created";
      clinicId: string;
      consultationId: string;
      petId: string;
      scheduledAt: Date;
    }
  | {
      type: "consultation.confirmed";
      clinicId: string;
      consultationId: string;
      petId: string;
      scheduledAt: Date;
    }
  | {
      type: "consultation.cancelled";
      clinicId: string;
      consultationId: string;
      petId: string;
    }
  | {
      type: "exam.created";
      clinicId: string;
      examId: string;
      petId: string;
      status: string;
    }
  | {
      type: "exam.ready";
      clinicId: string;
      examId: string;
      petId: string;
    }
  | {
      type: "vaccine.created";
      clinicId: string;
      petId: string;
      vaccineId: string;
      vaccineName: string;
      nextDueAt: Date | null;
    }
  | {
      type: "vaccine.due";
      clinicId: string;
      petId: string;
      vaccineId: string;
      vaccineName: string;
      dueAt: Date;
    }
  | { type: "pet.birthday"; clinicId: string; petId: string };

export type CommsEventType = CommsEvent["type"];

class CommsEventBus extends EventEmitter {
  emitEvent(event: CommsEvent) {
    this.emit("event", event);
  }
  onEvent(handler: (event: CommsEvent) => void | Promise<void>) {
    this.on("event", handler);
  }
}

export const commsBus: CommsEventBus = new CommsEventBus();
commsBus.setMaxListeners(50);
