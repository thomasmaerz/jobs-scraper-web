import ConfigClient from "@/components/config/ConfigClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Scraper Configuration | JobTrack",
};

export default function ConfigPage() {
  return <ConfigClient />;
}
