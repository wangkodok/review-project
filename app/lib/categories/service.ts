import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export type CategoryDto = {
  id: string;
  name: string;
  slug: string;
};

type CategoryRow = CategoryDto & {
  is_active: boolean;
  sort_order: number;
};

export async function getActiveCategories(): Promise<CategoryDto[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .returns<CategoryRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(({ id, name, slug }) => ({ id, name, slug }));
}

export async function getCategoryForWrite(categoryId: string): Promise<CategoryDto | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,is_active,sort_order")
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle<CategoryRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
  };
}

export async function getActiveCategoryBySlug(slug: string): Promise<CategoryDto | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug,is_active,sort_order")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<CategoryRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
  };
}
