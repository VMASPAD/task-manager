import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./App.css"
import Process from "./layouts/Process";
import Graph from "./layouts/Graph";
export default function App() {
  return (
  <div className="mt-5">
 <Tabs defaultValue="tab-2" orientation="vertical" className="w-full flex-row">
      <TabsList className="flex-col rounded-none border-l bg-transparent p-0">
        <TabsTrigger
          value="tab-1"
          className="data-[state=active]:after:bg-primary relative w-full justify-start rounded-none after:absolute after:inset-y-0 after:start-0 after:w-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          Process
        </TabsTrigger>
        <TabsTrigger
          value="tab-2"
          className="data-[state=active]:after:bg-primary relative w-full justify-start rounded-none after:absolute after:inset-y-0 after:start-0 after:w-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          Graph
        </TabsTrigger> 
      </TabsList>
      <div className="grow rounded-md border text-start">
        <TabsContent value="tab-1">
          <p className="text-muted-foreground px-4 py-3 text-xs"><Process /></p>
        </TabsContent>
        <TabsContent value="tab-2">
          <p className="text-muted-foreground px-4 py-3 text-xs"><Graph /></p>
        </TabsContent> 
      </div>
    </Tabs>
    </div>
  );
}
