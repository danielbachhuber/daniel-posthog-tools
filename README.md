# Daniel's PostHog Tools

Some CLI commands for when you're building PostHog locally.

Note: The script initially couldn't write to PostHog running on `localhost:8000`. I commented out `# ::1     localhost` in `/etc/hosts` and it worked. Not sure why!

## Using

### Create sample data for an experiment

1. Create a new experiment through the PostHog web interface. For example, "Daniel Funnel Experiment Nov 12 v2" with a feature flag of "daniel-funnel-experiment-nov-12-v2"
2. Send the initial events for the experiment: `daniel-posthog-tools mock-experiment-events funnel daniel-funnel-experiment-nov-12-v2 --send-initial-events`
3. Wait a moment for PostHog to digest the events.
4. If you're not quite sure whether the event showed up, copy the unique hash from the distinct ID and search for the user under "People & groups".
5. For a funnel experiment, set `$pageview` as the first conversion goal step, and `[daniel-funnel-experiment-nov-12-v2] signup` as the second conversion goal step.
6. Launch the experiment, and then set the start date to two weeks prior.
7. Run `daniel-posthog-tools mock-experiment-events funnel daniel-funnel-experiment-nov-12-v2` to populate some data. It's safe to run multiple times.

Other notes:

- If you run `daniel-posthog-tools mock-data-warehouse-experiment`, you'll need to run the temporal server to injest the data warehouse table _after_ you generate all of the events. You'll also need to manually run a sync.
