import { useState } from "react";
import { Search, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminUsersQueryKey,
  useListAdminUsers,
  type AdminCustomer,
} from "@workspace/api-client-react";

type Balance = { currency: "EGP" | "USD"; pending: number; available: number };
type Customer = AdminCustomer & { balances: Balance[] };

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: loading, isError } = useListAdminUsers({
    query: { queryKey: getListAdminUsersQueryKey() },
  });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"EGP" | "USD">("EGP");
  const [operation, setOperation] = useState<"add" | "deduct">("add");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(editing.customerId)}/cashback`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: Number(amount), currency, operation }),
        },
      );
      if (!response.ok) {
        toast.error("Could not update cashback");
        return;
      }
      toast.success("Cashback updated");
      setEditing(null);
      setAmount("");
      await queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
    } finally {
      setSaving(false);
    }
  };
  const filtered = users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">
          View customers and adjust their cashback balances.
        </p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-3 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users"
          className="w-full rounded-xl bg-white border px-10 py-2.5"
        />
      </div>
      <div className="bg-white rounded-3xl border overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="p-4 text-start">Customer</th>
              <th className="p-4 text-start">Orders</th>
              <th className="p-4 text-start">Available</th>
              <th className="p-4 text-start">Pending</th>
              <th className="p-4 text-end">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-10 text-center">
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-red-600">
                  Could not load customers. Please try again.
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.customerId}>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <UserRound className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                        <p className="text-xs font-mono text-primary">
                          {user.referralCode}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{user.orderCount}</td>
                  <td className="p-4">
                    {user.balances.map((b) => (
                      <div key={b.currency}>
                        {b.currency} {b.available.toFixed(2)}
                      </div>
                    ))}
                  </td>
                  <td className="p-4">
                    {user.balances.map((b) => (
                      <div key={b.currency}>
                        {b.currency} {b.pending.toFixed(2)}
                      </div>
                    ))}
                  </td>
                  <td className="p-4 text-end">
                    <button
                      onClick={() => setEditing(user)}
                      className="inline-flex gap-2 rounded-xl bg-primary text-white px-4 py-2"
                    >
                      <Wallet className="w-4 h-4" />
                      Adjust
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">
              Adjust {editing.name}'s cashback
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={operation}
                onChange={(e) =>
                  setOperation(e.target.value as "add" | "deduct")
                }
                className="border rounded-xl p-3"
              >
                <option value="add">Add</option>
                <option value="deduct">Deduct</option>
              </select>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "EGP" | "USD")}
                className="border rounded-xl p-3"
              >
                <option>EGP</option>
                <option>USD</option>
              </select>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="w-full border rounded-xl p-3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 border rounded-xl p-3"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !amount || Number(amount) <= 0}
                className="flex-1 bg-primary text-white rounded-xl p-3 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
