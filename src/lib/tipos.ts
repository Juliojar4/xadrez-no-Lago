
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "classes": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"join_code": string,"name": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"join_code": string,"name": string,"teacher_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"join_code"?: string,"name"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "black_id": string,"black_rating_after": number | null,"black_rating_before": number | null,"black_rd_after": number | null,"black_rd_before": number | null,"class_id": string,"confirmed_by": string | null,"created_at": string,"id": string,"mode": string,"pgn": string | null,"played_at": string | null,"rated": boolean,"reported_by": string,"status": string,"white_id": string,"white_rating_after": number | null,"white_rating_before": number | null,"white_rd_after": number | null,"white_rd_before": number | null,"white_score": number
                  }
                  ComputedFields: never
                  Insert: {
                    "black_id": string,"black_rating_after"?: number | null,"black_rating_before"?: number | null,"black_rd_after"?: number | null,"black_rd_before"?: number | null,"class_id": string,"confirmed_by"?: string | null,"created_at"?: string,"id"?: string,"mode"?: string,"pgn"?: string | null,"played_at"?: string | null,"rated"?: boolean,"reported_by": string,"status"?: string,"white_id": string,"white_rating_after"?: number | null,"white_rating_before"?: number | null,"white_rd_after"?: number | null,"white_rd_before"?: number | null,"white_score": number
                  }
                  Update: {
                    "black_id"?: string,"black_rating_after"?: number | null,"black_rating_before"?: number | null,"black_rd_after"?: number | null,"black_rd_before"?: number | null,"class_id"?: string,"confirmed_by"?: string | null,"created_at"?: string,"id"?: string,"mode"?: string,"pgn"?: string | null,"played_at"?: string | null,"rated"?: boolean,"reported_by"?: string,"status"?: string,"white_id"?: string,"white_rating_after"?: number | null,"white_rating_before"?: number | null,"white_rd_after"?: number | null,"white_rd_before"?: number | null,"white_score"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_black_id_fkey"
      columns: ["black_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_white_id_fkey"
      columns: ["white_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"guardian_students": {
                  Row: {
                    "guardian_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "guardian_id": string,"student_id": string
                  }
                  Update: {
                    "guardian_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guardian_students_guardian_id_fkey"
      columns: ["guardian_id"]
isOneToOne: false
      referencedRelation: "guardians"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guardian_students_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"guardians": {
                  Row: {
                    "created_at": string,"email": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"student_secrets": {
                  Row: {
                    "failed_attempts": number,"locked_until": string | null,"pin_hash": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "failed_attempts"?: number,"locked_until"?: string | null,"pin_hash": string,"student_id": string
                  }
                  Update: {
                    "failed_attempts"?: number,"locked_until"?: string | null,"pin_hash"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_secrets_student_id_fkey"
      columns: ["student_id"]
isOneToOne: true
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "active": boolean,"avatar": string,"class_id": string,"created_at": string,"games_played": number,"id": string,"initial_level": string,"last_played_at": string | null,"nickname": string,"rating": number,"rd": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"avatar": string,"class_id": string,"created_at"?: string,"games_played"?: number,"id": string,"initial_level": string,"last_played_at"?: string | null,"nickname": string,"rating": number,"rd": number
                  }
                  Update: {
                    "active"?: boolean,"avatar"?: string,"class_id"?: string,"created_at"?: string,"games_played"?: number,"id"?: string,"initial_level"?: string,"last_played_at"?: string | null,"nickname"?: string,"rating"?: number,"rd"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    }
                  ]
                },"teachers": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "apply_game_result":
{ Args: { "p": Json }; Returns: undefined
                           },
"apply_recalc":
{ Args: { "p_class": string,"p_expected": number,"p_games": Json,"p_students": Json,"p_void": string }; Returns: undefined
                           },
"claim_pin_attempt":
{ Args: { "p_student": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
