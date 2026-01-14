// web/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Zod schema for registration payload
const registerSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  role: z.nativeEnum(Role),
  orgId: z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid organization ID",
  }),
  storeIds: z.array(z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid store ID",
  })).optional().default([]),
});

export async function POST(request: Request) {
  let supabaseUserId: string | null = null;

  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input", details: validation.error.flatten() }, { status: 400 });
    }

    const { name, email, password, role, orgId, storeIds } = validation.data;

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json({ error: `Organization with id ${orgId} not found` }, { status: 404 });
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    // Verify Supabase user does not already exist
    const { data: existingSupabaseUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (existingSupabaseUser?.user) {
      return NextResponse.json({ error: "User already exists in Supabase Auth" }, { status: 409 });
    }

    // Create Supabase Auth user
    const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: name,
      },
      app_metadata: {
        role,
        orgId,
      },
    });

    if (createAuthError || !createdAuth?.user) {
      return NextResponse.json(
        { error: createAuthError?.message || "Failed to create Supabase auth user" },
        { status: 500 }
      );
    }

    supabaseUserId = createdAuth.user.id;

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user and update stores in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the user
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          orgId,
          storeIds,
        },
      });

      // 2. If stores are assigned, update those store documents
      if (storeIds && storeIds.length > 0) {
        await tx.store.updateMany({
          where: {
            id: {
              in: storeIds,
            },
            // Also ensure the store belongs to the same organization
            orgId: orgId,
          },
          data: {
            userIds: {
              push: newUser.id,
            },
          },
        });
      }
      
      return newUser;
    });

    // Omit passwordHash from the response
    const { passwordHash: _, ...userWithoutPassword } = result;

    return NextResponse.json({ user: userWithoutPassword }, { status: 201 });

  } catch (error) {
    console.error("Registration Error:", error);
    if (supabaseUserId) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUserId).catch(() => {});
    }
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
