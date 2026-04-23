import { prisma } from "@amir/db";

export interface DefaultFamilyContext {
  familyId: string;
  familyName: string;
  childId: string;
  childName: string;
  childBirthDate: string;
  timeZone: string;
  actors: {
    mom: {
      userId: string;
      username: string;
    };
    dad: {
      userId: string;
      username: string;
    };
  };
}

const DEFAULT_TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Europe/Moscow";
const DEFAULT_FAMILY_NAME = process.env.DEFAULT_FAMILY_NAME ?? "Семья Амира";
const DEFAULT_CHILD_NAME = process.env.DEFAULT_CHILD_NAME ?? process.env.BOT_DEFAULT_CHILD_NAME ?? "Амир";
const DEFAULT_CHILD_BIRTH_DATE = process.env.DEFAULT_CHILD_BIRTH_DATE ?? "2026-04-20";

function normalizeUsername(value: string | undefined, fallback: string) {
  const normalized = value?.trim().replace(/^@+/, "");
  return normalized ? normalized : fallback;
}

function parseBirthDate(value: string) {
  const trimmed = value.trim();

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(2026, 3, 20, 0, 0, 0, 0));
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0));
}

function buildTelegramPlaceholder(username: string, actor: "mom" | "dad") {
  return `app:${actor}:${username}`;
}

export async function ensureDefaultFamilyContext(): Promise<DefaultFamilyContext> {
  const momUsername = normalizeUsername(process.env.DEFAULT_MOM_USERNAME, "manizha_u");
  const dadUsername = normalizeUsername(process.env.DEFAULT_DAD_USERNAME, "yamob");
  const childBirthDate = parseBirthDate(DEFAULT_CHILD_BIRTH_DATE);

  return prisma.$transaction(async (tx) => {
    let family =
      (await tx.family.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      })) ??
      (await tx.family.create({
        data: {
          name: DEFAULT_FAMILY_NAME,
          timeZone: DEFAULT_TIME_ZONE,
        },
      }));

    if (family.name !== DEFAULT_FAMILY_NAME || family.timeZone !== DEFAULT_TIME_ZONE) {
      family = await tx.family.update({
        where: { id: family.id },
        data: {
          name: DEFAULT_FAMILY_NAME,
          timeZone: DEFAULT_TIME_ZONE,
          deletedAt: null,
        },
      });
    }

    const mom = await tx.user.upsert({
      where: {
        telegramUserId: buildTelegramPlaceholder(momUsername, "mom"),
      },
      update: {
        firstName: "Мама",
        displayName: "Мама",
        locale: "ru-RU",
        timeZone: DEFAULT_TIME_ZONE,
        deletedAt: null,
      },
      create: {
        telegramUserId: buildTelegramPlaceholder(momUsername, "mom"),
        firstName: "Мама",
        displayName: "Мама",
        locale: "ru-RU",
        timeZone: DEFAULT_TIME_ZONE,
      },
    });

    const dad = await tx.user.upsert({
      where: {
        telegramUserId: buildTelegramPlaceholder(dadUsername, "dad"),
      },
      update: {
        firstName: "Папа",
        displayName: "Папа",
        locale: "ru-RU",
        timeZone: DEFAULT_TIME_ZONE,
        deletedAt: null,
      },
      create: {
        telegramUserId: buildTelegramPlaceholder(dadUsername, "dad"),
        firstName: "Папа",
        displayName: "Папа",
        locale: "ru-RU",
        timeZone: DEFAULT_TIME_ZONE,
      },
    });

    await tx.familyMember.upsert({
      where: {
        familyId_userId: {
          familyId: family.id,
          userId: mom.id,
        },
      },
      update: {
        role: "OWNER",
        deletedAt: null,
      },
      create: {
        familyId: family.id,
        userId: mom.id,
        role: "OWNER",
      },
    });

    await tx.familyMember.upsert({
      where: {
        familyId_userId: {
          familyId: family.id,
          userId: dad.id,
        },
      },
      update: {
        role: "PARTNER",
        deletedAt: null,
      },
      create: {
        familyId: family.id,
        userId: dad.id,
        role: "PARTNER",
      },
    });

    const existingChild = await tx.child.findFirst({
      where: {
        familyId: family.id,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const child = existingChild
      ? await tx.child.update({
          where: { id: existingChild.id },
          data: {
            name: DEFAULT_CHILD_NAME,
            birthDate: childBirthDate,
            deletedAt: null,
          },
        })
      : await tx.child.create({
          data: {
            familyId: family.id,
            name: DEFAULT_CHILD_NAME,
            birthDate: childBirthDate,
            sex: "MALE",
          },
        });

    return {
      familyId: family.id,
      familyName: family.name,
      childId: child.id,
      childName: child.name,
      childBirthDate: child.birthDate.toISOString(),
      timeZone: family.timeZone,
      actors: {
        mom: {
          userId: mom.id,
          username: momUsername,
        },
        dad: {
          userId: dad.id,
          username: dadUsername,
        },
      },
    };
  });
}
