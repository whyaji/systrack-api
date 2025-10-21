import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { asc, desc, isNull, like, or } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { and } from 'drizzle-orm';
import { ne } from 'drizzle-orm';
import { count } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '../db/database.js';
import { usersTable } from '../db/schema/schema.js';
import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import {
  createPaginationResponse,
  getPaginationParams,
  paginationSchema,
} from '../lib/pagination.js';
import authMiddleware from '../middleware/jwt.js';

const hashSalt = env.HASH_SALT;

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateUserSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').optional(),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

const userIdSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
});

// for user management CRUD
export const userRoute = new Hono()
  .use(authMiddleware)
  // Create user
  .post('/', zValidator('json', createUserSchema), async (c) => {
    try {
      const { name, email, password } = c.req.valid('json');

      // Check if user with email already exists
      const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email));

      if (existingUser.length > 0) {
        return c.json({ message: 'User with this email already exists.' }, 400);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, hashSalt ?? 'salt');

      // Create user
      await db.insert(usersTable).values({
        name,
        email,
        password: hashedPassword,
      });

      const newUser = await db.select().from(usersTable).where(eq(usersTable.email, email));

      if (!newUser[0]) {
        return c.json({ message: 'Failed to create user.' }, 500);
      }

      // Remove password from response
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = newUser[0];

      return c.json(
        {
          success: true,
          message: 'User created successfully.',
          data: userWithoutPassword,
        },
        201
      );
    } catch (error) {
      logger.error(`Error creating user: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })
  // Get all users with pagination, search, and sorting
  .get('/', zValidator('query', paginationSchema), async (c) => {
    try {
      const { page, limit, search, sort_by, order } = c.req.valid('query');
      const { offset } = getPaginationParams(page, limit);

      // Build search conditions
      const searchConditions = search
        ? or(like(usersTable.name, `%${search}%`), like(usersTable.email, `%${search}%`))
        : undefined;

      // Build where clause
      const whereClause = searchConditions
        ? and(isNull(usersTable.deletedAt), searchConditions)
        : isNull(usersTable.deletedAt);

      // Get total count of users
      const totalResult = await db.select({ count: count() }).from(usersTable).where(whereClause);

      const total = totalResult[0].count;

      // Build order by clause
      const orderBy =
        order === 'desc'
          ? desc(usersTable[sort_by as keyof typeof usersTable.$inferSelect])
          : asc(usersTable[sort_by as keyof typeof usersTable.$inferSelect]);

      // Get paginated users
      const users = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
        })
        .from(usersTable)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      const response = createPaginationResponse(
        users,
        total,
        page,
        limit,
        search || '',
        sort_by,
        order
      );

      return c.json(response);
    } catch (error) {
      logger.error(`Error fetching users: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })
  // Get user by ID
  .get('/:id', zValidator('param', userIdSchema), async (c) => {
    try {
      const { id } = c.req.valid('param');

      const user = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
        })
        .from(usersTable)
        .where(and(eq(usersTable.id, id), isNull(usersTable.deletedAt)));

      if (user.length === 0) {
        return c.json({ message: 'User not found.' }, 404);
      }

      return c.json({
        success: true,
        data: user[0],
      });
    } catch (error) {
      logger.error(`Error fetching user: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })
  // Update user
  .put(
    '/:id',
    zValidator('param', userIdSchema),
    zValidator('json', updateUserSchema),
    async (c) => {
      try {
        const { id } = c.req.valid('param');
        const updateData = c.req.valid('json');

        // Check if user exists
        const existingUser = await db
          .select()
          .from(usersTable)
          .where(and(eq(usersTable.id, id), isNull(usersTable.deletedAt)));

        if (existingUser.length === 0) {
          return c.json({ message: 'User not found.' }, 404);
        }

        // Check if email is being updated and if it already exists
        if (updateData.email && updateData.email !== existingUser[0].email) {
          const emailExists = await db
            .select()
            .from(usersTable)
            .where(and(eq(usersTable.email, updateData.email), ne(usersTable.id, id)));

          if (emailExists.length > 0) {
            return c.json({ message: 'Email already exists.' }, 400);
          }
        }

        // Prepare update data
        const updateValues: Partial<typeof usersTable.$inferSelect> = {
          updatedAt: new Date(),
        };

        if (updateData.name) {
          updateValues.name = updateData.name;
        }

        if (updateData.email) {
          updateValues.email = updateData.email;
        }

        if (updateData.password) {
          updateValues.password = await bcrypt.hash(updateData.password, hashSalt ?? 'salt');
        }

        // Update user
        await db.update(usersTable).set(updateValues).where(eq(usersTable.id, id));

        const updatedUser = await db.select().from(usersTable).where(eq(usersTable.id, id));

        if (updatedUser.length === 0) {
          return c.json({ message: 'Failed to update user.' }, 500);
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _password, ...userWithoutPassword } = updatedUser[0];

        return c.json({
          success: true,
          message: 'User updated successfully.',
          data: userWithoutPassword,
        });
      } catch (error) {
        logger.error(`Error updating user: ${error}`);
        return c.json({ message: 'Internal server error.' }, 500);
      }
    }
  )
  // Delete user (soft delete)
  .delete('/:id', zValidator('param', userIdSchema), async (c) => {
    try {
      const { id } = c.req.valid('param');

      // Check if user exists
      const existingUser = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.id, id), isNull(usersTable.deletedAt)));

      if (existingUser.length === 0) {
        return c.json({ message: 'User not found.' }, 404);
      }

      // Soft delete user
      await db
        .update(usersTable)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, id));

      return c.json({
        success: true,
        message: 'User deleted successfully.',
      });
    } catch (error) {
      logger.error(`Error deleting user: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  });
