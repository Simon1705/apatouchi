import type {
  ShoppingPriority,
  ShoppingStatus,
} from "@/features/shopping/shopping-schema";

/** Baris barang belanja beserta pembuat dan pembeli yang di-embed. */
export type ShoppingItemRecord = {
  id: string;
  name: string;
  quantity: number;
  priority: ShoppingPriority;
  status: ShoppingStatus;
  created_by: string;
  purchased_by: string | null;
  purchased_at: string | null;
  created_at: string;
  creator: { display_name: string } | null;
  buyer: { display_name: string } | null;
};
