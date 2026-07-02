import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { vi } from "vitest";
import testPrisma from "./setup.js";

// Mock the prisma singleton to use the test client
vi.mock("../../lib/prisma.js", () => ({
	default: testPrisma,
}));

// Import app AFTER mocking prisma
const { default: app } = await import("../../app.js");
import request from "supertest";

describe("Task API E2E Tests", () => {
	beforeEach(async () => {
		// Clean up database between tests
		await testPrisma.task.deleteMany();
	});

	afterAll(async () => {
		await testPrisma.$disconnect();
	});

	describe("POST /api/tasks", () => {
		it("should create a new task", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "E2E Task", description: "E2E Description" });

			expect(res.status).toBe(201);
			expect(res.body).toHaveProperty("id");
			expect(res.body.title).toBe("E2E Task");
			expect(res.body.description).toBe("E2E Description");
			expect(res.body.completed).toBe(false);
		});

		it("should return 400 when title is missing", async () => {
			const res = await request(app).post("/api/tasks").send({});

			expect(res.status).toBe(400);
			expect(res.body).toHaveProperty("error");
		});

		it("should return 400 when title is empty", async () => {
			const res = await request(app).post("/api/tasks").send({ title: "   " });

			expect(res.status).toBe(400);
			expect(res.body).toHaveProperty("error");
		});
	});

	describe("GET /api/tasks", () => {
		it("should return empty array when no tasks exist", async () => {
			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(res.body).toEqual([]);
		});

		it("should return all tasks ordered by createdAt desc", async () => {
			await testPrisma.task.create({ data: { title: "First Task" } });
			await testPrisma.task.create({ data: { title: "Second Task" } });

			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(res.body).toHaveLength(2);
			expect(res.body[0].title).toBe("Second Task");
			expect(res.body[1].title).toBe("First Task");
		});
	});

	describe("GET /api/tasks/:id", () => {
		it("should return a task by id", async () => {
			const task = await testPrisma.task.create({ data: { title: "Task to Find" } });

			const res = await request(app).get(`/api/tasks/${task.id}`);

			expect(res.status).toBe(200);
			expect(res.body.id).toBe(task.id);
			expect(res.body.title).toBe("Task to Find");
		});

		it("should return 404 when task not found", async () => {
			const res = await request(app).get("/api/tasks/99999");

			expect(res.status).toBe(404);
			expect(res.body).toHaveProperty("error");
		});

		it("should return 400 on invalid id", async () => {
			const res = await request(app).get("/api/tasks/abc");

			expect(res.status).toBe(400);
			expect(res.body).toHaveProperty("error");
		});
	});

	describe("PUT /api/tasks/:id", () => {
		it("should update a task title", async () => {
			const task = await testPrisma.task.create({ data: { title: "Original Title" } });

			const res = await request(app)
				.put(`/api/tasks/${task.id}`)
				.send({ title: "Updated Title" });

			expect(res.status).toBe(200);
			expect(res.body.title).toBe("Updated Title");
		});

		it("should mark a task as completed", async () => {
			const task = await testPrisma.task.create({ data: { title: "Task" } });

			const res = await request(app)
				.put(`/api/tasks/${task.id}`)
				.send({ completed: true });

			expect(res.status).toBe(200);
			expect(res.body.completed).toBe(true);
		});

		it("should return 404 when task not found", async () => {
			const res = await request(app)
				.put("/api/tasks/99999")
				.send({ title: "New Title" });

			expect(res.status).toBe(404);
			expect(res.body).toHaveProperty("error");
		});

		it("should return 400 on invalid id", async () => {
			const res = await request(app)
				.put("/api/tasks/abc")
				.send({ title: "New Title" });

			expect(res.status).toBe(400);
			expect(res.body).toHaveProperty("error");
		});
	});

	describe("DELETE /api/tasks/:id", () => {
		it("should delete a task and return 204", async () => {
			const task = await testPrisma.task.create({ data: { title: "Task to Delete" } });

			const res = await request(app).delete(`/api/tasks/${task.id}`);

			expect(res.status).toBe(204);

			const deleted = await testPrisma.task.findUnique({ where: { id: task.id } });
			expect(deleted).toBeNull();
		});

		it("should return 404 when task not found", async () => {
			const res = await request(app).delete("/api/tasks/99999");

			expect(res.status).toBe(404);
			expect(res.body).toHaveProperty("error");
		});

		it("should return 400 on invalid id", async () => {
			const res = await request(app).delete("/api/tasks/abc");

			expect(res.status).toBe(400);
			expect(res.body).toHaveProperty("error");
		});
	});
});
