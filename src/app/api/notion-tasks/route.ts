import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATA_SOURCE_ID = "31c6a25e-43e7-80fa-b823-000b12e22547";

function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getTodayISO();

    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      filter: {
        property: "Due Date",
        date: {
          equals: date,
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks = response.results.map((page: any) => {
      const props = page.properties;
      if (!props) return null;

      const nameProp = props["Name"];
      let label = "";
      if (nameProp?.title?.length > 0) {
        label = nameProp.title.map((t: { plain_text: string }) => t.plain_text).join("");
      }

      const done = props["Done"]?.checkbox === true;

      return {
        id: page.id,
        label,
        done,
      };
    }).filter(Boolean);

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Notion tasks error:", message);
    return NextResponse.json({ tasks: [], error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { pageId, done } = await request.json();

    await notion.pages.update({
      page_id: pageId,
      properties: {
        Done: {
          checkbox: done,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Notion update error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
