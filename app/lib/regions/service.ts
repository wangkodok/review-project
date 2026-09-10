import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export type RegionDto = {
  id: string;
  name: string;
  slug: string;
};

type RegionRow = RegionDto & {
  is_active: boolean;
  sort_order: number;
};

export async function getActiveRegions(): Promise<RegionDto[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("regions")
    .select("id,name,slug,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .returns<RegionRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(({ id, name, slug }) => ({ id, name, slug }));
}

export async function getRegionForWrite(regionId: string): Promise<RegionDto | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("regions")
    .select("id,name,slug,is_active,sort_order")
    .eq("id", regionId)
    .eq("is_active", true)
    .maybeSingle<RegionRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? { id: data.id, name: data.name, slug: data.slug } : null;
}

export async function getActiveRegionBySlug(slug: string): Promise<RegionDto | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("regions")
    .select("id,name,slug,is_active,sort_order")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<RegionRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? { id: data.id, name: data.name, slug: data.slug } : null;
}
