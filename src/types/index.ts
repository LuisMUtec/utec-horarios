export interface Session {
  type: string;          // "TEORÍA 1", "LABORATORIO 11"
  modality: string;      // "Presencial" | "Sincronico"
  day: string;           // "Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab"
  startTime: string;     // "09:00"
  endTime: string;       // "11:00"
  frequency: string;     // "Semana General" | "Semana A" | "Semana B"
  location: string;      // "UTEC-BA A904"
  capacity: number;      // 45
  enrolled: number;      // 0
  professor: string;     // "Ojeda Rios, Brenner Humberto"
  email: string;         // "bojeda@utec.edu.pe"
}

export interface Section {
  number: number;        // 1, 2, 3...
  sessions: Session[];
}

export interface Course {
  code: string;          // "CS2023"
  name: string;          // "Algoritmos y Estructuras de Datos"
  sections: Section[];
}

export interface SelectedCourse {
  courseCode: string;
  sectionNumber: number;
}

export interface CalendarEvent {
  courseCode: string;
  courseName: string;
  session: Session;
  color: string;
  isPreview?: boolean;
}
