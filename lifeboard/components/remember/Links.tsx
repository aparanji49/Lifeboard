import { Link } from "lucide-react";
import { useState } from "react";
import LinkActions from "./LinkActions";
import { Button } from "../ui/button";

export default function Links() {
  const [addLinkFormVisible, setAddLinkFormVisible] = useState(false);
  const [links, setLinks] = useState<
    Array<{ url: string; description: string }>
  >([]);


  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        {/* Displaying Links */}
        {links.length === 0 && (
          <p className="text-sm text-gray-500">No links added yet.</p>
        )}
        {links.map((link, index) => (
          <div key={index} className="flex flex-col mb-2">
            <div className="flex flex-row justify-between">
              <a href="#" className="text-blue-600 hover:underline">
                {link.url}
              </a>
              <LinkActions />
            </div>
            <div className="text-sm text-gray-500">{link.description}</div>
          </div>
        ))}
      </div>

      <Button variant='outline' size='sm' className="rounded-full mt-2 align-self-center" onClick={()=> setAddLinkFormVisible(!addLinkFormVisible)}>Add New Link</Button>
      {addLinkFormVisible && (
        <form className="flex flex-col gap-2 mt-2">
          <input
            type="url"
            placeholder="URL"
            className="p-2 border lifeboard-input"
          />
          <input
            type="text"
            placeholder="Description"
            className="p-2 border lifeboard-input"
          />
          <div className="flex flex-row justify-end gap-2">
            <button
              type="button"
              className="text-sm lifeboard-secondary-button"
              onClick={() => setAddLinkFormVisible(false)}
            >
              Cancel
            </button>
            <button type="submit" className="text-sm lifeboard-primary-button">
              Add Link
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
