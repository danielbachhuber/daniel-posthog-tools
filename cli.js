#!/usr/bin/env node

import { program } from "commander";
import { PostHog } from "posthog-node";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const posthog = new PostHog(process.env.POSTHOG_API_KEY, {
  host: process.env.POSTHOG_HOST,
});

program
  .name("daniel-posthog-tools")
  .showHelpAfterError()
  .showSuggestionAfterError();

program.version("1.0.0");

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return [...Array(length)]
    .map(() => characters.charAt(Math.floor(Math.random() * characters.length)))
    .join("");
}

program
  .command("mock-experiment-events")
  .argument(
    "<type>",
    "The type of experiment to mock (funnel or trend)",
    (value) => {
      if (!["funnel", "trend"].includes(value)) {
        throw new Error('Type must be either "funnel" or "trend"');
      }
      return value;
    }
  )
  .argument("<flag>", "The flag associated with the experiment")
  .option(
    "--start_date <date>",
    "Start date for events",
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  )
  .option(
    "--send-initial-events",
    "Send the initial events for the experiment",
    false
  )
  .action(async (type, flag, options) => {
    const defaultEvents =
      type === "funnel"
        ? ["$pageview", `[${flag}] signup`]
        : [`[${flag}] event one`, `[${flag}] event two`];

    if (options.sendInitialEvents) {
      const distinctId = `test-user-${generateRandomString(10)}@example.com`;

      for (const event of defaultEvents) {
        const timestamp = new Date(
          Date.now() - 12 * 60 * 60 * 1000
        ).toISOString();
        posthog.capture({
          event,
          distinctId,
          timestamp,
        });
        console.log(`Sent ${event} for ${distinctId} at ${timestamp}`);
      }
      await posthog.shutdown();
      console.log(`Sent initial events for ${flag}`);
      return;
    }

    // Send events for 100 users, split between control and test
    const startDate = new Date(options.start_date).getTime();
    const now = Date.now();

    for (let i = 0; i < 100; i++) {
      const distinctId = `test-user-${generateRandomString(10)}@example.com`;

      // Feature flag requests aren't backdated, unforunately.
      const variant = await posthog.getFeatureFlag(flag, distinctId);
      console.log(`${flag} variant for ${distinctId} is ${variant}`);

      // Generate random timestamp between start_date and now for first event
      const firstEventTime = startDate + Math.random() * (now - startDate);
      const firstEventTimestamp = new Date(firstEventTime).toISOString();

      // Send first event for all users
      posthog.capture({
        event: defaultEvents[0],
        distinctId,
        timestamp: firstEventTimestamp,
        properties: {
          [`$feature/${flag}`]: variant,
        },
      });
      console.log(
        `Sent ${defaultEvents[0]} for ${distinctId} at ${firstEventTimestamp} (${variant} group)`
      );

      // Only send second event for ~40% of users
      if (Math.random() < 0.4) {
        // Add 5-30 minutes to first event timestamp for second event
        const minutesToAdd = 5 + Math.random() * 25; // Random minutes between 5 and 30
        const secondEventTime = firstEventTime + minutesToAdd * 60 * 1000;

        // Ensure second event time doesn't exceed current time
        const secondEventTimestamp = new Date(
          Math.min(secondEventTime, now)
        ).toISOString();

        posthog.capture({
          event: defaultEvents[1],
          distinctId,
          timestamp: secondEventTimestamp,
          properties: {
            [`$feature/${flag}`]: variant,
          },
        });
        console.log(
          `Sent ${defaultEvents[1]} for ${distinctId} at ${secondEventTimestamp} (${variant} group)`
        );
      }
    }

    await posthog.shutdown();
    console.log(`Sent events for ${flag} experiment`);
  });

program
  .command("mock-data-warehouse-experiment")
  .argument("<flag>", "The flag associated with the experiment")
  .option(
    "--start_date <date>",
    "Start date for events",
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  )
  .option(
    "--send-initial-events",
    "Send the initial events for the experiment",
    false
  )
  .action(async (flag, options) => {
    console.log(`Mocking data warehouse experiment for ${flag}`);

    // Create MySQL connection
    let connection;
    try {
      connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
      });
    } catch (error) {
      console.error("Error creating MySQL connection:", error);
      return;
    }

    // Create payments table if it doesn't exist
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME,
        distinct_id VARCHAR(255),
        amount DECIMAL(10,2)
        )
      `);
      console.log("Created payments table");
    } catch (error) {
      console.error("Error creating payments table:", error);
      return;
    }

    if (options.sendInitialEvents) {
      const distinctId = `test-user-${generateRandomString(10)}@example.com`;
      const variant = await posthog.getFeatureFlag(flag, distinctId);
      console.log(`${flag} variant for ${distinctId} is ${variant}`);
      await posthog.shutdown();
      console.log(`Sent initial event for ${flag}`);
      const amount = 5 + Math.random() * 5;
      await connection.execute(
        "INSERT INTO payments (timestamp, distinct_id, amount) VALUES (NOW(), ?, ?)",
        [distinctId, amount]
      );
      console.log(
        `Created payment record for ${distinctId} with amount ${amount.toFixed(
          2
        )}`
      );
      await connection.end();
      console.log("The end");
      return;
    }

    const startDate = new Date(options.start_date).getTime();
    const now = Date.now();

    for (let i = 0; i < 200; i++) {
      const distinctId = `test-user-${generateRandomString(10)}@example.com`;

      // Generate random timestamp between start date and now
      const timestamp = new Date(startDate + Math.random() * (now - startDate));

      posthog.capture({
        event: `[${flag}] seen`,
        distinctId,
        timestamp: timestamp.toISOString(),
      });
      console.log(`Sent seen event for ${distinctId}`);

      // 60% chance to get feature flag
      let variant;
      if (Math.random() < 0.6) {
        variant = await posthog.getFeatureFlag(flag, distinctId);
        console.log(`${flag} variant for ${distinctId} is ${variant}`);
      }

      // 80% chance to generate payment
      if (Math.random() < 0.8) {
        const amount = 2 + Math.random() * 18; // Random amount between 2 and 20

        const paymentTimestamp = new Date(
          timestamp.getTime() + Math.random() * (now - timestamp.getTime())
        );

        await connection.execute(
          "INSERT INTO payments (timestamp, distinct_id, amount) VALUES (?, ?, ?)",
          [paymentTimestamp, distinctId, amount]
        );
        console.log(
          `Created payment record for ${distinctId} with amount ${amount.toFixed(
            2
          )}`
        );
        posthog.capture({
          event: `[${flag}] payment`,
          distinctId,
          timestamp: paymentTimestamp.toISOString,
          properties: variant ? { [`$feature/${flag}`]: variant } : undefined,
        });
      }
    }

    await posthog.shutdown();

    await connection.end();
  });

if (process.argv.length === 2) {
  program.help();
}

program.parse();
