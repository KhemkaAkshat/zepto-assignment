# Zepto Flow — Order Recovery Simulator

A responsive static React app that demonstrates how a quick-commerce order moves through fulfilment, and how predefined failures are handled safely.

It is a visual simulation only: it does not call payment, store, rider, delivery, map, or backend services.

## Run locally

Prerequisite: Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

To create a production build:

```bash
npm run build
```

## How the app works

The order journey contains nine stages:

1. Order Placed
2. Payment Verification
3. Dark Store Selection
4. Inventory Reservation
5. Picking
6. Packing
7. Rider Assignment
8. Pickup
9. Delivered

The progress tracker is horizontal on larger screens and becomes vertical on mobile.

## Testing a scenario

1. Choose an edge case from the **Scenario Library**. Cases are grouped into Payment, Dark Store, Rider, and Delivery.
2. The order stops at the stage affected by that case. That stage is highlighted amber for a recoverable problem or red for a terminal one.
3. Read **What happened** to see the simulated issue.
4. Read **Solution** to see the recovery action the system takes.
5. Click **Apply solution** for a recoverable issue, then use **Next stage** to continue the order to delivery.

You can also use:

- **Auto play** — animates the order from the first stage to its final outcome.
- **Start over** — returns to the beginning of the normal flow.
- **Run normal flow** — loads a successful order with no exception.

## Outcomes

| Scenario type | Visual state | Result |
| --- | --- | --- |
| Recoverable | Amber warning | The displayed solution is applied and the order resumes its normal journey. |
| Terminal | Red failure | The order ends as Cancelled and the displayed closure/refund action is shown. |
| Normal flow | Green success | The order progresses through all stages to Delivered. |

## Project structure

```text
src/
  main.jsx       # Scenario data, simulation state, and UI
  styles.css     # Tailwind directives and custom responsive/animated styles
index.html        # App entry page
vite.config.js    # Vite configuration
```

## Tech stack

- React + Vite
- JavaScript
- Tailwind CSS
- Plain CSS transitions and keyframes
