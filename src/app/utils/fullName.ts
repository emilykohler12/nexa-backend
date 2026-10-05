// RF-02 — el apellido vive en su propia columna (users.last_name). Para mostrar
// a una persona en vistas, mails y el log de actividad se arma "Nombre Apellido";
// las cuentas sin apellido (viejas o de profesionales) se ven solo con el nombre.
export function fullName(user: { name: string; lastName?: string | null }): string {
  return user.lastName ? `${user.name} ${user.lastName}` : user.name
}
