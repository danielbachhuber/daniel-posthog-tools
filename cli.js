#!/usr/bin/env node

import { program } from "commander";
import { PostHog } from "posthog-node";
import dotenv from "dotenv";

dotenv.config();

const posthog = new PostHog(process.env.POSTHOG_API_KEY, {
  host: process.env.POSTHOG_HOST,
  historicalMigration: true,
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
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();
        posthog.capture({
          event,
          distinctId,
          timestamp,
          properties: {
            [`$feature/${flag}`]: "control",
          },
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

      // Randomly assign users to control (50%) or test (50%) variant
      const variant = Math.random() < 0.5 ? "control" : "test";

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

if (process.argv.length === 2) {
  program.help();
}

program.parse();
