import { DateTime } from "luxon";
import { disconnectSeedClient, runProductionSeed, seedPrisma } from "./seed-base.js";

async function runDemoSeed() {
  if (process.env.NODE_ENV === "production") throw new Error("El seed demo está bloqueado en NODE_ENV=production.");
  const { business, admin } = await runProductionSeed();

  let category = await seedPrisma.serviceCategory.findUnique({ where: { businessId_name: { businessId: business.id, name: "Demo - Barbería" } } });
  category ??= await seedPrisma.serviceCategory.create({
    data: { businessId: business.id, name: "Demo - Barbería", description: "Categoría creada por el seed demo", sortOrder: 900 },
  });

  const services = [];
  for (const item of [
    { name: "Demo - Corte", price: "15000.00", durationMinutes: 45, color: "#2563EB" },
    { name: "Demo - Barba", price: "9000.00", durationMinutes: 30, color: "#0F766E" },
  ]) {
    let service = await seedPrisma.service.findUnique({ where: { businessId_name: { businessId: business.id, name: item.name } } });
    service ??= await seedPrisma.service.create({ data: { businessId: business.id, categoryId: category.id, ...item } });
    services.push(service);
  }

  const employeeEmail = "profesional.demo@borkin.local";
  let employee = await seedPrisma.employee.findUnique({ where: { businessId_email: { businessId: business.id, email: employeeEmail } } });
  employee ??= await seedPrisma.employee.create({
    data: { businessId: business.id, firstName: "Profesional", lastName: "Demo", email: employeeEmail, color: "#7C3AED" },
  });
  await seedPrisma.employeeService.createMany({
    data: services.map((service) => ({ employeeId: employee!.id, serviceId: service.id })),
    skipDuplicates: true,
  });
  for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek += 1) {
    const schedule = await seedPrisma.employeeSchedule.findFirst({ where: { employeeId: employee.id, dayOfWeek, startMinute: 540, endMinute: 1080 } });
    if (!schedule) await seedPrisma.employeeSchedule.create({ data: { employeeId: employee.id, dayOfWeek, startMinute: 540, endMinute: 1080 } });
  }

  const phoneNormalized = "5493515550199";
  let client = await seedPrisma.client.findFirst({ where: { businessId: business.id, phoneNormalized } });
  client ??= await seedPrisma.client.create({
    data: {
      businessId: business.id,
      firstName: "Cliente",
      lastName: "Demo",
      phone: "+54 9 351 555 0199",
      phoneNormalized,
      email: "cliente.demo@borkin.local",
      emailNormalized: "cliente.demo@borkin.local",
      notes: "Registro exclusivo del seed demo.",
    },
  });

  const appointmentMarker = "Seed demo explícito";
  const appointment = await seedPrisma.appointment.findFirst({ where: { businessId: business.id, notes: appointmentMarker } });
  if (!appointment) {
    const start = DateTime.now().setZone(business.timezone).plus({ days: 7 }).startOf("day").set({ hour: 10 }).toUTC();
    const created = await seedPrisma.appointment.create({
      data: {
        businessId: business.id,
        clientId: client.id,
        serviceId: services[0]!.id,
        employeeId: employee.id,
        createdById: admin.id,
        startAt: start.toJSDate(),
        endAt: start.plus({ minutes: services[0]!.durationMinutes }).toJSDate(),
        durationMinutes: services[0]!.durationMinutes,
        serviceName: services[0]!.name,
        price: services[0]!.price,
        status: "PENDIENTE",
        notes: appointmentMarker,
      },
    });
    await seedPrisma.appointmentStatusEvent.create({
      data: { businessId: business.id, appointmentId: created.id, userId: admin.id, toStatus: "PENDIENTE", reason: appointmentMarker },
    });
  }

  console.info("Seed demo aplicado: servicios, profesional, cliente y turno de ejemplo disponibles.");
}

runDemoSeed()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectSeedClient);
